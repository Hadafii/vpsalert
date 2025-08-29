// components/DevMonitor.tsx - NEW FILE untuk development mode
"use client";

import React, { useState, useEffect, useRef } from "react";
import { logger } from "@/lib/logs";
import { useVPSMonitor } from "@/hooks/useVPSMonitor"; // FIX: Import the hook

interface DevMonitorProps {
  isVisible?: boolean;
}

interface SystemStats {
  sse: {
    connected: boolean;
    events: number;
    activeConnections: number;
    lastMessage?: string;
  };
  api: {
    lastFetch?: Date;
    responseTime?: number;
    errors: number;
  };
  cron: {
    lastRun?: string;
    status?: string;
  };
  database: {
    status?: string;
    lastQuery?: Date;
  };
}

export const DevMonitor: React.FC<DevMonitorProps> = ({
  isVisible = process.env.NODE_ENV === "development",
}) => {
  // FIX: Get state from useVPSMonitor hook
  const { connectionMode, isTabVisible, sseEvents } = useVPSMonitor({
    enableSSE: true,
  });

  const [stats, setStats] = useState<SystemStats>({
    sse: { connected: false, events: 0, activeConnections: 0 },
    api: { errors: 0 },
    cron: {},
    database: {},
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const addLog = (
    message: string,
    type: "info" | "success" | "error" | "warning" = "info"
  ) => {
    const timestamp = new Date().toLocaleTimeString();
    const emoji = {
      info: "ℹ️",
      success: "✅",
      error: "❌",
      warning: "⚠️",
    }[type];

    const logEntry = `[${timestamp}] ${emoji} ${message}`;
    setLogs((prev) => [...prev.slice(-50), logEntry]);
  };

  // ====================================
  // SSE MONITORING
  // ====================================

  const setupSSEMonitoring = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    addLog("Setting up SSE monitoring...", "info");

    try {
      const eventSource = new EventSource("/api/sse/status");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        addLog("SSE connection established", "success");
        setStats((prev) => ({
          ...prev,
          sse: { ...prev.sse, connected: true },
        }));
      };

      eventSource.onmessage = (event) => {
        const eventData = JSON.parse(event.data);
        addLog(`SSE event: ${eventData.type}`, "info");

        setStats((prev) => ({
          ...prev,
          sse: {
            ...prev.sse,
            events: prev.sse.events + 1,
            lastMessage: eventData.type,
            activeConnections:
              eventData.activeConnections || prev.sse.activeConnections,
          },
        }));
      };

      eventSource.onerror = (error) => {
        addLog("SSE connection error", "error");
        setStats((prev) => ({
          ...prev,
          sse: { ...prev.sse, connected: false },
        }));
      };
    } catch (error) {
      addLog(`SSE setup failed: ${(error as Error).message}`, "error");
    }
  };

  const testAPIEndpoint = async () => {
    addLog("Testing /api/status endpoint...", "info");
    const startTime = Date.now();

    try {
      const response = await fetch("/api/status?summary=true");
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        addLog(`API test success (${responseTime}ms)`, "success");
        setStats((prev) => ({
          ...prev,
          api: { lastFetch: new Date(), responseTime, errors: prev.api.errors },
        }));
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      addLog(`API test failed: ${(error as Error).message}`, "error");
      setStats((prev) => ({
        ...prev,
        api: { ...prev.api, errors: prev.api.errors + 1 },
      }));
    }
  };

  const testStatusChange = async () => {
    addLog("Triggering manual status change...", "info");

    try {
      const response = await fetch("/api/test/sse-trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Test-Secret": process.env.NEXT_PUBLIC_CRON_SECRET || "",
        },
        body: JSON.stringify({
          model: 1,
          datacenter: "SBG",
          status: Math.random() > 0.5 ? "available" : "out-of-stock",
        }),
      });

      const result = await response.json();

      if (result.success) {
        addLog(`Status change triggered: ${result.message}`, "success");
      } else {
        addLog(`Status change failed: ${result.error}`, "error");
      }
    } catch (error) {
      addLog(`Status change error: ${(error as Error).message}`, "error");
    }
  };

  const testCronJob = async () => {
    addLog("Testing cron job endpoint...", "info");

    try {
      const response = await fetch(
        `/api/cron/poll-ovh?secret=${process.env.NEXT_PUBLIC_CRON_SECRET}`
      );
      const result = await response.json();

      if (result.success) {
        addLog(
          `Cron test success: ${result.summary.changes_detected} changes`,
          "success"
        );
        setStats((prev) => ({
          ...prev,
          cron: {
            lastRun: new Date().toISOString(),
            status: "success",
          },
        }));
      } else {
        addLog("Cron test failed", "error");
      }
    } catch (error) {
      addLog(`Cron test error: ${(error as Error).message}`, "error");
    }
  };

  const runDiagnostics = async () => {
    addLog("Running full system diagnostics...", "info");

    try {
      const response = await fetch("/api/test/diagnostics");
      const result = await response.json();

      addLog(
        `Database: ${result.database.status}`,
        result.database.error ? "error" : "success"
      );
      addLog(
        `SSE: ${result.sse.endpoint_accessible ? "Accessible" : "Failed"}`,
        result.sse.endpoint_accessible ? "success" : "error"
      );
      addLog(
        `Circuit breaker: ${result.ovh_api.circuit_breaker?.state}`,
        "info"
      );

      setStats((prev) => ({
        ...prev,
        database: {
          status: result.database.status,
          lastQuery: new Date(),
        },
        sse: {
          ...prev.sse,
          activeConnections: result.sse.active_connections || 0,
        },
      }));
    } catch (error) {
      addLog(`Diagnostics failed: ${(error as Error).message}`, "error");
    }
  };

  // ====================================
  // AUTO-START MONITORING
  // ====================================

  useEffect(() => {
    if (isVisible) {
      setupSSEMonitoring();
      addLog("DevMonitor initialized", "success");

      // Auto-run diagnostics on start
      setTimeout(runDiagnostics, 1000);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isVisible]);

  // ====================================
  // RENDER
  // ====================================

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          mb-2 px-4 py-2 rounded-lg shadow-lg font-mono text-sm transition-all
          ${
            stats.sse.connected
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }
          hover:scale-105
        `}
      >
        🧪 DEV {stats.sse.connected ? "🟢" : "🔴"} (
        {sseEvents || stats.sse.events})
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="bg-gray-900 text-green-400 rounded-lg shadow-2xl p-4 w-96 max-h-[80vh] overflow-hidden flex flex-col font-mono text-xs">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700">
            <h3 className="text-white font-bold">🔧 Development Monitor</h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div
              className={`p-2 rounded ${stats.sse.connected ? "bg-green-900" : "bg-red-900"}`}
            >
              <div className="font-semibold">SSE</div>
              <div>
                {stats.sse.connected ? "🟢 Connected" : "🔴 Disconnected"}
              </div>
              <div>{sseEvents || stats.sse.events} events</div>
            </div>

            <div className="p-2 rounded bg-blue-900">
              <div className="font-semibold">API</div>
              <div>{stats.api.responseTime || 0}ms</div>
              <div>{stats.api.errors} errors</div>
            </div>

            <div className="p-2 rounded bg-purple-900">
              <div className="font-semibold">Database</div>
              <div>{stats.database.status || "Unknown"}</div>
            </div>

            <div className="p-2 rounded bg-orange-900">
              <div className="font-semibold">Tab</div>
              <div>{isTabVisible ? "👁️ Visible" : "👻 Hidden"}</div>
              <div>Mode: {connectionMode || "unknown"}</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={testAPIEndpoint}
              className="bg-blue-700 hover:bg-blue-600 p-2 rounded text-white"
            >
              🔍 Test API
            </button>

            <button
              onClick={testStatusChange}
              className="bg-green-700 hover:bg-green-600 p-2 rounded text-white"
            >
              🔄 Test Change
            </button>

            <button
              onClick={testCronJob}
              className="bg-orange-700 hover:bg-orange-600 p-2 rounded text-white"
            >
              ⏰ Test Cron
            </button>

            <button
              onClick={runDiagnostics}
              className="bg-purple-700 hover:bg-purple-600 p-2 rounded text-white"
            >
              🩺 Diagnostics
            </button>
          </div>

          {/* Logs */}
          <div className="flex-1 overflow-hidden">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-yellow-400 font-semibold">
                📋 Logs ({logs.length})
              </h4>
              <button
                onClick={() => setLogs([])}
                className="text-gray-400 hover:text-white text-xs"
              >
                Clear
              </button>
            </div>

            <div className="bg-black p-2 rounded max-h-60 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500">No logs yet...</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1 text-xs leading-relaxed">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Console Helpers */}
          <div className="mt-4 pt-2 border-t border-gray-700">
            <p className="text-gray-400 text-xs mb-2">Console commands:</p>
            <div className="text-xs text-blue-300">
              <div>• window.testSSE()</div>
              <div>• window.triggerChange()</div>
              <div>• window.sseStats()</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ====================================
// CONSOLE HELPERS SETUP
// ====================================

export const setupDevConsoleHelpers = () => {
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    // Test SSE manually
    (window as any).testSSE = () => {
      console.log("🔌 Testing SSE connection...");
      const eventSource = new EventSource("/api/sse/status");

      eventSource.onopen = () => console.log("✅ SSE connected");
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("📨 SSE message:", data);
      };
      eventSource.onerror = (error) => console.error("❌ SSE error:", error);

      return eventSource;
    };

    // Trigger status change
    (window as any).triggerChange = async (model = 1, datacenter = "SBG") => {
      const status = Math.random() > 0.5 ? "available" : "out-of-stock";

      try {
        const response = await fetch("/api/test/sse-trigger", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Test-Secret": process.env.NEXT_PUBLIC_CRON_SECRET || "",
          },
          body: JSON.stringify({ model, datacenter, status }),
        });

        const result = await response.json();
        console.log("🔄 Change result:", result);
        return result;
      } catch (error) {
        console.error("❌ Change failed:", error);
      }
    };

    // Get SSE stats
    (window as any).sseStats = async () => {
      try {
        const response = await fetch("/api/test/sse-stats");
        const result = await response.json();
        console.log("📊 SSE Stats:", result);
        return result;
      } catch (error) {
        console.error("❌ Stats failed:", error);
      }
    };

    console.log(
      "🧪 Dev helpers loaded! Try: window.testSSE(), window.triggerChange(), window.sseStats()"
    );
  }
};

export default DevMonitor;
