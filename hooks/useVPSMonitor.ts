// hooks/useVPSMonitor.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  DatacenterStatus,
  MonitorData,
  VPSModelData,
} from "@/app/components/Monitor";
import { logger } from "@/lib/logs";
// ====================================
// TYPES
// ====================================

interface APIResponse {
  models: Record<number, DatacenterStatus[]>;
  summary: {
    total: number;
    available: number;
    outOfStock: number;
    availabilityPercentage: number;
  };
  lastUpdated: string;
  count: number;
}

interface UseVPSMonitorOptions {
  refreshInterval?: number; // in milliseconds
  enableSSE?: boolean;
  onError?: (error: Error) => void;
  onUpdate?: (data: MonitorData) => void;
}

interface UseVPSMonitorReturn {
  data: MonitorData | null;
  isLoading: boolean;
  error: string | null;
  lastFetch: Date | null;
  refetch: () => Promise<void>;
  isConnected: boolean; // SSE connection status
}

// ====================================
// VPS MODEL CONFIGURATIONS
// ====================================

const VPS_CONFIGS = {
  1: { name: "VPS-1", specs: "4 vCores, 8GB RAM, 75GB SSD", price: "US$4.20" },
  2: {
    name: "VPS-2",
    specs: "6 vCores, 12GB RAM, 100GB SSD",
    price: "US$6.75",
  },
  3: {
    name: "VPS-3",
    specs: "8 vCores, 24GB RAM, 200GB SSD",
    price: "US$12.75",
  },
  4: {
    name: "VPS-4",
    specs: "12 vCores, 48GB RAM, 300GB SSD",
    price: "US$25.08",
  },
  5: {
    name: "VPS-5",
    specs: "16 vCores, 64GB RAM, 350GB SSD",
    price: "US$34.34",
  },
  6: {
    name: "VPS-6",
    specs: "24 vCores, 96GB RAM, 400GB SSD",
    price: "US$45.39",
  },
} as const;

// ====================================
// UTILITY FUNCTIONS
// ====================================

const parseSpecs = (specs: string) => {
  const parts = specs.split(", ");
  return {
    cpu: parts[0] || "",
    ram: parts[1] || "",
    storage: parts[2] || "",
    bandwidth: parts[3] || "",
  };
};

const transformAPIData = (apiData: APIResponse): MonitorData => {
  // Transform the grouped models data into VPSModelData array
  const models: VPSModelData[] = Object.entries(apiData.models).map(
    ([modelNum, datacenters]) => {
      const modelNumber = parseInt(modelNum);
      const config = VPS_CONFIGS[modelNumber as keyof typeof VPS_CONFIGS];
      const specs = parseSpecs(config?.specs || "");

      const availableCount = datacenters.filter(
        (dc) => dc.status === "available"
      ).length;
      const totalCount = datacenters.length;

      return {
        model: modelNumber,
        name: config?.name || `VPS-${modelNumber}`,
        price: config?.price || "N/A",
        specs,
        datacenters,
        availableCount,
        totalCount,
      };
    }
  );

  return {
    models: models.sort((a, b) => a.model - b.model), // Ensure proper ordering
    summary: apiData.summary,
    lastUpdated: apiData.lastUpdated,
  };
};

// ====================================
// MAIN HOOK
// ====================================

export const useVPSMonitor = (
  options: UseVPSMonitorOptions = {}
): UseVPSMonitorReturn => {
  const {
    refreshInterval = 15000, // 15 seconds default
    enableSSE = false,
    onError,
    onUpdate,
  } = options;

  // State
  const [data, setData] = useState<MonitorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isComponentMountedRef = useRef(true);

  // Create axios instance with interceptors
  const api = axios.create({
    baseURL: "/api",
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Response interceptor for error handling
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      logger.error("API Error:", error);

      let message = "An unexpected error occurred";

      if (error.code === "ECONNABORTED") {
        message = "Request timeout - server may be busy";
      } else if (error.response) {
        // Server responded with error status
        message =
          error.response.data?.message ||
          `Server error (${error.response.status})`;
      } else if (error.request) {
        // Request made but no response received
        message = "No response from server - please check your connection";
      }

      return Promise.reject(new Error(message));
    }
  );

  // ====================================
  // DATA FETCHING
  // ====================================

  const fetchData = useCallback(async (): Promise<MonitorData | null> => {
    try {
      setError(null);

      const response = await api.get<APIResponse>("/status", {
        params: {
          format: "grouped",
          summary: "true",
        },
      });

      const transformedData = transformAPIData(response.data);
      return transformedData;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch VPS status";
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      return null;
    }
  }, [api, onError]);

  const refetch = useCallback(async (): Promise<void> => {
    if (!isComponentMountedRef.current) return;

    setIsLoading(true);

    try {
      const newData = await fetchData();

      if (newData && isComponentMountedRef.current) {
        setData(newData);
        setLastFetch(new Date());
        onUpdate?.(newData);
      }
    } catch (err) {
      logger.error("Refetch error:", err);
    } finally {
      if (isComponentMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchData, onUpdate]);

  // SERVER-SENT EVENTS
  // ====================================

  const setupSSE = useCallback(() => {
    if (!enableSSE || typeof window === "undefined") return;

    // Prevent multiple connections
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      logger.log("SSE already connected, skipping setup");
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      logger.log("Closing existing SSE connection");
      eventSourceRef.current.close();
    }

    try {
      logger.log("Setting up new SSE connection");
      const eventSource = new EventSource("/api/sse/status");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        logger.log("SSE connection established");
        if (isComponentMountedRef.current) {
          setIsConnected(true);
          setError(null);
        }
      };

      eventSource.onmessage = (event) => {
        if (!isComponentMountedRef.current) return;

        try {
          const eventData = JSON.parse(event.data);

          if (eventData.type === "status-update" && eventData.updates) {
            // Handle real-time updates
            setData((currentData) => {
              if (!currentData) return currentData;

              // Update the data with the new status changes
              const updatedModels = currentData.models.map((model) => ({
                ...model,
                datacenters: model.datacenters.map((dc) => {
                  const update = eventData.updates.find(
                    (u: any) =>
                      u.model === model.model && u.datacenter === dc.datacenter
                  );

                  if (update) {
                    return { ...dc, status: update.status };
                  }
                  return dc;
                }),
              }));

              // Recalculate summary
              const totalAvailable = updatedModels.reduce(
                (sum, model) =>
                  sum +
                  model.datacenters.filter((dc) => dc.status === "available")
                    .length,
                0
              );
              const totalDCs = updatedModels.reduce(
                (sum, model) => sum + model.datacenters.length,
                0
              );

              const updatedData: MonitorData = {
                ...currentData,
                models: updatedModels,
                summary: {
                  ...currentData.summary,
                  available: totalAvailable,
                  outOfStock: totalDCs - totalAvailable,
                  availabilityPercentage:
                    totalDCs > 0
                      ? Math.round((totalAvailable / totalDCs) * 100)
                      : 0,
                },
                lastUpdated: new Date().toISOString(),
              };

              // Call onUpdate only if component is still mounted
              if (isComponentMountedRef.current && onUpdate) {
                onUpdate(updatedData);
              }
              return updatedData;
            });
          }
        } catch (err) {
          logger.error("Error parsing SSE data:", err);
        }
      };

      eventSource.onerror = (error) => {
        logger.error("SSE error:", error);
        if (isComponentMountedRef.current) {
          setIsConnected(false);
        }

        // Don't attempt auto-reconnect to prevent infinite loops
        // Let the component handle reconnection manually
      };
    } catch (err) {
      logger.error("Failed to setup SSE:", err);
      if (isComponentMountedRef.current) {
        setIsConnected(false);
      }
    }
  }, [enableSSE]); // Removed onUpdate from dependencies

  // ====================================
  // EFFECTS
  // ====================================

  // Initial data fetch
  useEffect(() => {
    isComponentMountedRef.current = true;
    refetch();

    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);

  // Setup polling
  useEffect(() => {
    if (refreshInterval > 0 && !enableSSE) {
      intervalRef.current = setInterval(refetch, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [refreshInterval, enableSSE, refetch]);

  // Setup SSE - Only run once when enableSSE changes
  useEffect(() => {
    if (enableSSE) {
      setupSSE();
    }

    return () => {
      if (eventSourceRef.current) {
        logger.log("Cleaning up SSE connection");
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      }
    };
  }, [enableSSE]); // Removed setupSSE from dependencies to prevent re-runs

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentMountedRef.current = false;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // ====================================
  // RETURN
  // ====================================

  return {
    data,
    isLoading,
    error,
    lastFetch,
    refetch,
    isConnected: enableSSE ? isConnected : true, // Always true for polling mode
  };
};
