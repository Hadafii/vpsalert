"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { logger } from "@/lib/logs";

interface DatacenterStatus {
  id: number;
  model: number;
  datacenter: string;
  status: "available" | "out-of-stock";
  last_checked: string;
  last_changed: string | null;
}

interface VPSModelData {
  model: number;
  name: string;
  price: string;
  specs: {
    cpu: string;
    ram: string;
    storage: string;
    bandwidth: string;
  };
  datacenters: DatacenterStatus[];
  availableCount: number;
  totalCount: number;
}

interface MonitorData {
  models: VPSModelData[];
  summary: {
    total: number;
    available: number;
    outOfStock: number;
    availabilityPercentage: number;
  };
  lastUpdated: string;
}

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
  refreshInterval?: number;
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
  isConnected: boolean;
  connectionMode: "sse" | "polling" | "offline";
  sseEvents: number;
  isTabVisible: boolean;
}

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
  const models: VPSModelData[] = Object.entries(apiData.models).map(
    ([modelNum, datacenters]) => {
      const modelNumber = parseInt(modelNum);
      const config = VPS_CONFIGS[modelNumber as keyof typeof VPS_CONFIGS];
      const specs = parseSpecs(config?.specs || "");
      const availableCount = datacenters.filter(
        (dc) => dc.status === "available"
      ).length;

      return {
        model: modelNumber,
        name: config?.name || `VPS-${modelNumber}`,
        price: config?.price || "N/A",
        specs,
        datacenters,
        availableCount,
        totalCount: datacenters.length,
      };
    }
  );

  return {
    models: models.sort((a, b) => a.model - b.model),
    summary: apiData.summary,
    lastUpdated: apiData.lastUpdated,
  };
};

export const useVPSMonitor = (
  options: UseVPSMonitorOptions = {}
): UseVPSMonitorReturn => {
  const {
    refreshInterval = 15000,
    enableSSE = true,
    onError,
    onUpdate,
  } = options;

  const [data, setData] = useState<MonitorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionMode, setConnectionMode] = useState<
    "sse" | "polling" | "offline"
  >("offline");
  const [sseEvents, setSseEvents] = useState(0);
  const [isTabVisible, setIsTabVisible] = useState(() =>
    typeof document !== "undefined" ? !document.hidden : true
  );

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isComponentMountedRef = useRef(true);
  const initializationRef = useRef(false);
  const callbacksRef = useRef({ onError, onUpdate });

  useEffect(() => {
    callbacksRef.current = { onError, onUpdate };
  });

  const fetchVPSData = useCallback(async (): Promise<MonitorData | null> => {
    try {
      const response = await fetch("/api/status?summary=true", {
        cache: "no-cache",
        headers: { "Cache-Control": "no-cache" },
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const rawData: APIResponse = await response.json();
      return transformAPIData(rawData);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to fetch VPS data");
      setError(error.message);
      callbacksRef.current.onError?.(error);
      return null;
    }
  }, []);

  const updateData = useCallback((newData: MonitorData) => {
    if (!isComponentMountedRef.current) return;

    setData(newData);
    setLastFetch(new Date());
    setError(null);
    callbacksRef.current.onUpdate?.(newData);
  }, []);

  const refetch = useCallback(async (): Promise<void> => {
    if (!isComponentMountedRef.current) return;

    logger.log("Manual refetch triggered");
    setIsLoading(true);

    try {
      const newData = await fetchVPSData();
      if (newData) {
        updateData(newData);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchVPSData, updateData]);

  const createSSEConnection = useCallback(() => {
    if (!enableSSE || typeof window === "undefined") return;

    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      logger.log("SSE already connected");
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      logger.log("Establishing SSE connection");
      const eventSource = new EventSource("/api/sse/status");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (isComponentMountedRef.current) {
          logger.log("SSE connected");
          setIsConnected(true);
          setConnectionMode("sse");
          setError(null);
        }
      };

      eventSource.onmessage = (event) => {
        if (!isComponentMountedRef.current) return;

        try {
          const eventData = JSON.parse(event.data);
          setSseEvents((prev) => prev + 1);

          if (eventData.type === "status-update" && eventData.updates) {
            setData((currentData) => {
              if (!currentData) return currentData;

              const updatedModels = currentData.models.map((model) => ({
                ...model,
                datacenters: model.datacenters.map((dc) => {
                  const update = eventData.updates.find(
                    (u: any) =>
                      u.model === model.model && u.datacenter === dc.datacenter
                  );
                  return update ? { ...dc, status: update.status } : dc;
                }),
              }));

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

              callbacksRef.current.onUpdate?.(updatedData);
              return updatedData;
            });
          }
        } catch (err) {
          logger.error("SSE message parse error:", err);
        }
      };

      eventSource.onerror = () => {
        if (isComponentMountedRef.current) {
          logger.error("SSE connection error");
          setIsConnected(false);
          setConnectionMode(refreshInterval > 0 ? "polling" : "offline");
        }
      };
    } catch (err) {
      logger.error("SSE setup failed:", err);
      setConnectionMode(refreshInterval > 0 ? "polling" : "offline");
    }
  }, [enableSSE, refreshInterval]);

  const setupPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (refreshInterval > 0 && (!enableSSE || !isConnected)) {
      logger.log(`Setting up polling: ${refreshInterval}ms`);

      intervalRef.current = setInterval(async () => {
        if (!isComponentMountedRef.current) return;

        const newData = await fetchVPSData();
        if (newData) {
          updateData(newData);
        }
      }, refreshInterval);

      setConnectionMode("polling");
    }
  }, [refreshInterval, enableSSE, isConnected, fetchVPSData, updateData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsTabVisible(visible);

      if (visible && enableSSE && !isConnected) {
        logger.log("Tab visible, reconnecting SSE");
        createSSEConnection();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [enableSSE, isConnected, createSSEConnection]);

  useEffect(() => {
    if (initializationRef.current) return;

    initializationRef.current = true;
    isComponentMountedRef.current = true;

    logger.log("useVPSMonitor initializing");

    const initialize = async () => {
      const initialData = await fetchVPSData();
      if (initialData && isComponentMountedRef.current) {
        updateData(initialData);
      }

      setIsLoading(false);

      if (enableSSE) {
        createSSEConnection();
      } else {
        setConnectionMode(refreshInterval > 0 ? "polling" : "offline");
      }
    };

    initialize();

    return () => {
      isComponentMountedRef.current = false;
      initializationRef.current = false;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      logger.log("useVPSMonitor cleanup");
    };
  }, []);

  useEffect(() => {
    if (!initializationRef.current) return;

    setupPolling();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [setupPolling]);

  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      lastFetch,
      refetch,
      isConnected: enableSSE ? isConnected : true,
      connectionMode,
      sseEvents,
      isTabVisible,
    }),
    [
      data,
      isLoading,
      error,
      lastFetch,
      refetch,
      enableSSE,
      isConnected,
      connectionMode,
      sseEvents,
      isTabVisible,
    ]
  );
};
