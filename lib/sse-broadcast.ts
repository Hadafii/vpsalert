// lib/sse-broadcast.ts
import { getAllStatus, DatacenterStatus } from "./queries";
import { logger } from "./logs";

// ====================================
// SHARED SSE BROADCAST FUNCTIONALITY
// ====================================

// This file contains the SSE broadcasting logic that can be used
// by both the SSE route handler and cron jobs in Next.js 15

// Last known status for change detection
let lastStatusSnapshot: Map<string, DatacenterStatus> = new Map();

// Initialize status snapshot
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

// Get status changes without broadcasting (for cron jobs)
export const getStatusChanges = async () => {
  try {
    const currentStatuses = await getAllStatus();
    const updates: any[] = [];

    // Detect changes
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
          changed: !!lastStatus, // true if it was a change, false if it was new
        });

        // Update snapshot
        lastStatusSnapshot.set(key, status);
      }
    });

    return updates;
  } catch (error) {
    logger.error("Failed to get status changes:", error);
    return [];
  }
};

// For cron jobs that need to trigger SSE updates
// This will be used by cron endpoints to notify SSE connections
export const broadcastToSSE = async () => {
  try {
    // This function can be called by cron jobs to trigger SSE broadcasts
    // In practice, you'd implement a pub/sub system or webhook to notify the SSE route
    const updates = await getStatusChanges();

    if (updates.length > 0) {
      logger.log(`Detected ${updates.length} status changes for SSE broadcast`);

      // In a real implementation, you might:
      // 1. Use Redis pub/sub to notify SSE connections
      // 2. Use a webhook to POST to the SSE route
      // 3. Use server-sent events to other processes

      return updates;
    }

    return [];
  } catch (error) {
    logger.error("Failed to broadcast to SSE:", error);
    return [];
  }
};

// Initialize on first import
initializeStatusSnapshot();
