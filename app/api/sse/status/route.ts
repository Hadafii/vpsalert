import { NextRequest } from "next/server";
import { getAllStatus, getVPSModels } from "@/lib/queries";
import { logger } from "@/lib/logs";
import {
  getStatusChanges,
  initializeStatusSnapshot,
  sseConnections,
} from "@/lib/sse-broadcast";

interface SSEConnection {
  id: string;
  controller: ReadableStreamDefaultController;
  models: number[];
  lastPing: number;
  connected: boolean;
}

const connections = new Map<string, SSEConnection>();
const MAX_CONNECTIONS = parseInt(process.env.MAX_SSE_CONNECTIONS || "1000");
const PING_INTERVAL = 15000;
const CONNECTION_TIMEOUT = 300000;

let isServerStartup = true;

const cleanupOnStartup = () => {
  if (isServerStartup) {
    connections.clear();
    logger.log("SSE server initialized, cleared stale connections");
    isServerStartup = false;
  }
};

const generateConnectionId = (): string => {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const cleanupConnections = () => {
  const now = Date.now();
  const toDelete: string[] = [];

  connections.forEach((conn, id) => {
    if (!conn.connected || now - conn.lastPing > CONNECTION_TIMEOUT) {
      toDelete.push(id);
    }
  });

  toDelete.forEach((id) => {
    const conn = connections.get(id);
    if (conn) {
      try {
        conn.controller.close();
      } catch (e) {}
      connections.delete(id);
    }
  });

  logger.log(
    `Cleaned up ${toDelete.length} stale connections. Active: ${connections.size}`
  );
};

setInterval(cleanupConnections, 15000);

const createSSEMessage = (event: string, data: any, id?: string): string => {
  let message = "";
  if (id) message += `id: ${id}\n`;
  message += `event: ${event}\n`;
  message += `data: ${JSON.stringify(data)}\n\n`;
  return message;
};

const sendSSEMessage = (
  controller: ReadableStreamDefaultController,
  event: string,
  data: any,
  id?: string
) => {
  try {
    const message = createSSEMessage(event, data, id);
    controller.enqueue(new TextEncoder().encode(message));
  } catch (error) {
    logger.error("Failed to send SSE message:", error);
  }
};

const sendKeepAlive = (controller: ReadableStreamDefaultController) => {
  try {
    const message = `: keepalive ${Date.now()}\n\n`;
    controller.enqueue(new TextEncoder().encode(message));
  } catch (error) {
    logger.error("Failed to send keepalive:", error);
  }
};

const broadcastStatusUpdate = async () => {
  if (connections.size === 0) return;

  try {
    const updates = await getStatusChanges();

    if (updates.length > 0) {
      logger.log(
        `Broadcasting ${updates.length} status updates to ${connections.size} connections`
      );

      connections.forEach((conn, id) => {
        if (!conn.connected) return;

        const relevantUpdates = updates.filter(
          (update) =>
            conn.models.length === 0 || conn.models.includes(update.model)
        );

        if (relevantUpdates.length > 0) {
          sendSSEMessage(conn.controller, "status-update", {
            updates: relevantUpdates,
            timestamp: new Date().toISOString(),
          });
        }
      });
    }

    const now = Date.now();
    connections.forEach((conn, id) => {
      if (conn.connected && now - conn.lastPing > PING_INTERVAL) {
        sendKeepAlive(conn.controller);
        conn.lastPing = now;
      }
    });
  } catch (error) {
    logger.error("Failed to broadcast status updates:", error);
  }
};

initializeStatusSnapshot();

export async function GET(request: NextRequest) {
  cleanupOnStartup();

  if (connections.size >= MAX_CONNECTIONS) {
    cleanupConnections();
    if (connections.size >= MAX_CONNECTIONS) {
      logger.warn(
        `SSE connection limit reached: ${connections.size}/${MAX_CONNECTIONS}`
      );
      return new Response("Service temporarily unavailable", {
        status: 503,
        headers: {
          "Retry-After": "30",
        },
      });
    }
  }

  const { searchParams } = new URL(request.url);

  let subscribedModels: number[] = [];
  const modelsParam = searchParams.get("models");
  if (modelsParam) {
    try {
      subscribedModels = modelsParam
        .split(",")
        .map((m) => parseInt(m.trim()))
        .filter((m) => !isNaN(m));

      const validModels = getVPSModels();
      subscribedModels = subscribedModels.filter((m) =>
        validModels.includes(m)
      );
    } catch (error) {
      subscribedModels = [];
    }
  }

  const connectionId = generateConnectionId();

  logger.log(
    `New SSE connection: ${connectionId}, models: [${subscribedModels.join(", ")}]`
  );

  const stream = new ReadableStream({
    start(controller) {
      const connection: SSEConnection = {
        id: connectionId,
        controller,
        models: subscribedModels,
        lastPing: Date.now(),
        connected: true,
      };

      sseConnections.set(connectionId, connection);
      connections.set(connectionId, connection);

      sendSSEMessage(controller, "connected", {
        connectionId,
        subscribedModels,
        timestamp: new Date().toISOString(),
        activeConnections: connections.size,
      });

      getAllStatus()
        .then((statuses) => {
          const filteredStatuses =
            subscribedModels.length > 0
              ? statuses.filter((s) => subscribedModels.includes(s.model))
              : statuses;

          sendSSEMessage(controller, "initial-status", {
            statuses: filteredStatuses,
            timestamp: new Date().toISOString(),
          });
        })
        .catch((error) => {
          logger.error("Failed to send initial status:", error);
          sendSSEMessage(controller, "error", {
            message: "Failed to fetch initial status",
            timestamp: new Date().toISOString(),
          });
        });

      const heartbeatInterval = setInterval(() => {
        if (!connection.connected) {
          clearInterval(heartbeatInterval);
          return;
        }

        try {
          sendKeepAlive(controller);
          connection.lastPing = Date.now();
        } catch (error) {
          logger.error("Heartbeat failed:", error);
          connection.connected = false;
          clearInterval(heartbeatInterval);
        }
      }, PING_INTERVAL);

      request.signal.addEventListener("abort", () => {
        logger.log(`SSE connection closed: ${connectionId}`);
        connection.connected = false;

        connections.delete(connectionId);
        sseConnections.delete(connectionId);

        clearInterval(heartbeatInterval);

        try {
          controller.close();
        } catch (e) {}
      });
    },

    cancel() {
      logger.log(`SSE connection cancelled: ${connectionId}`);
      const connection = connections.get(connectionId);
      if (connection) {
        connection.connected = false;
        connections.delete(connectionId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
      "X-Connection-Id": connectionId,
    },
  });
}

export async function HEAD(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "stats") {
    return new Response(null, {
      status: 200,
      headers: {
        "X-Active-Connections": connections.size.toString(),
        "X-Max-Connections": MAX_CONNECTIONS.toString(),
        "X-Connection-Usage": `${Math.round((connections.size / MAX_CONNECTIONS) * 100)}%`,
      },
    });
  }

  return new Response(null, {
    status: 200,
    headers: {
      "X-SSE-Status": "ready",
    },
  });
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (action === "cleanup") {
    cleanupConnections();
    return new Response(
      JSON.stringify({
        message: "Cleanup completed",
        activeConnections: connections.size,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (action === "broadcast") {
    await broadcastStatusUpdate();
    return new Response(
      JSON.stringify({
        message: "Broadcast completed",
        activeConnections: connections.size,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response("Invalid action", { status: 400 });
}
