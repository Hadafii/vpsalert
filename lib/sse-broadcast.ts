import { getAllStatus, DatacenterStatus } from "./queries";
import { logger } from "./logs";

let lastStatusSnapshot: Map<string, DatacenterStatus> = new Map();
export const sseConnections = new Map<string, any>();
export const broadcastToActiveConnections = async (updateData: any) => {
  if (sseConnections.size === 0) {
    logger.log("No active SSE connections to broadcast to");
    return;
  }

  logger.log(`Broadcasting to ${sseConnections.size} active SSE connections`);

  const toRemove: string[] = [];

  sseConnections.forEach((connection, connectionId) => {
    try {
      if (connection.connected && connection.controller) {
        const sseMessage = `data: ${JSON.stringify(updateData)}\n\n`;
        connection.controller.enqueue(new TextEncoder().encode(sseMessage));
        logger.log(`✅ Broadcasted to connection: ${connectionId}`);
      } else {
        toRemove.push(connectionId);
      }
    } catch (error) {
      logger.error(`❌ Failed to broadcast to ${connectionId}:`, error);
      toRemove.push(connectionId);
    }
  });

  toRemove.forEach((id) => sseConnections.delete(id));

  if (toRemove.length > 0) {
    logger.log(`Cleaned up ${toRemove.length} dead SSE connections`);
  }
};

export const triggerSSEBroadcast = async (statusUpdates: any[]) => {
  if (statusUpdates.length === 0) return;

  const broadcastData = {
    type: "status-update",
    updates: statusUpdates,
    timestamp: new Date().toISOString(),
  };

  await broadcastToActiveConnections(broadcastData);

  logger.log(`SSE broadcast completed for ${statusUpdates.length} updates`);
};

export const initializeStatusSnapshot = async () => {
  try {
    const statuses = await getAllStatus();
    lastStatusSnapshot.clear();
    statuses.forEach((status) => {
      const key = `${status.model}_${status.datacenter}`;
      lastStatusSnapshot.set(key, status);
    });
  } catch (error) {
    logger.error("Failed to initialize status snapshot:", error);
  }
};

export const getStatusChanges = async () => {
  try {
    const currentStatuses = await getAllStatus();
    const updates: any[] = [];

    currentStatuses.forEach((status) => {
      const key = `${status.model}_${status.datacenter}`;
      const lastStatus = lastStatusSnapshot.get(key);

      if (!lastStatus || lastStatus.status !== status.status) {
        updates.push({
          model: status.model,
          datacenter: status.datacenter,
          status: status.status,
          oldStatus: lastStatus?.status || null,
          timestamp: new Date().toISOString(),
          changed: !!lastStatus,
        });

        lastStatusSnapshot.set(key, status);
      }
    });

    return updates;
  } catch (error) {
    logger.error("Failed to get status changes:", error);
    return [];
  }
};

export const broadcastToSSE = async () => {
  try {
    const updates = await getStatusChanges();

    if (updates.length > 0) {
      logger.log(`Detected ${updates.length} status changes for SSE broadcast`);

      return updates;
    }

    return [];
  } catch (error) {
    logger.error("Failed to broadcast to SSE:", error);
    return [];
  }
};

initializeStatusSnapshot();
