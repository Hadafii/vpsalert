"use client";
import React, { useEffect, useCallback, useMemo } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Badge,
  Button,
  Progress,
  Skeleton,
} from "@heroui/react";
import {
  IconTrendingUp,
  IconRefresh,
  IconWifi,
  IconWifiOff,
  IconServer,
} from "@tabler/icons-react";
import { useVPSMonitor } from "@/hooks/useVPSMonitor";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logs";

import VPSModelCard, { type VPSModelData } from "./VPSModelCard";
import SubscriptionForm from "./SubscriptionForm";
import DevMonitor, { setupDevConsoleHelpers } from "./DevMonitor";

export interface MonitorData {
  models: VPSModelData[];
  summary: {
    total: number;
    available: number;
    outOfStock: number;
    availabilityPercentage: number;
  };
  lastUpdated: string;
}

interface MonitorProps {}

const getTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  return `${Math.floor(diffMinutes / 1440)}d ago`;
};

const StatusOverview = React.memo<{
  summary: MonitorData["summary"];
  lastUpdated: string;
  isLoading: boolean;
}>(({ summary, lastUpdated, isLoading }) => (
  <Card className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-primary">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-200 dark:bg-blue-900/30 rounded-lg">
            <IconTrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Live Status Overview</h2>
            <p className="text-small text-default-500">
              Last updated:{" "}
              {isLoading ? "Updating..." : getTimeAgo(lastUpdated)}
            </p>
          </div>
        </div>
        <Badge
          content={summary.available}
          color="success"
          placement="top-right"
          className="text-white"
        >
          <div className="p-2 bg-success-100 rounded-lg">
            <IconServer className="w-6 h-6 text-success" />
          </div>
        </Badge>
      </div>
    </CardHeader>
    <CardBody className="pt-0">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-success-600 dark:text-success-400">
            {isLoading ? (
              <Skeleton className="h-8 w-12 mx-auto" />
            ) : (
              summary.available
            )}
          </div>
          <div className="text-small text-default-600">Available</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-danger-600 dark:text-danger-400">
            {isLoading ? (
              <Skeleton className="h-8 w-12 mx-auto" />
            ) : (
              summary.outOfStock
            )}
          </div>
          <div className="text-small text-default-600">Out of Stock</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {isLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : 6}
          </div>
          <div className="text-small text-default-600">Total Models</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-warning-600 dark:text-warning-400">
            {isLoading ? (
              <Skeleton className="h-8 w-12 mx-auto" />
            ) : (
              `${summary.availabilityPercentage}%`
            )}
          </div>
          <div className="text-small text-default-600">Availability</div>
        </div>
      </div>
      <Progress
        value={summary.availabilityPercentage}
        color="success"
        className="mt-4"
        size="sm"
      />
    </CardBody>
  </Card>
));
StatusOverview.displayName = "StatusOverview";

const ConnectionStatus = React.memo<{
  isConnected: boolean;
  isLoading: boolean;
  onRefresh: () => void;
}>(({ isConnected, isLoading, onRefresh }) => (
  <div className="flex items-center justify-center gap-4 mb-6">
    <div className="flex items-center gap-2">
      {isConnected ? (
        <>
          <IconWifi className="w-4 h-4 text-success-500" />
          <span className="text-small text-success-600 dark:text-success-400">
            Live Updates Active
          </span>
        </>
      ) : (
        <>
          <IconWifiOff className="w-4 h-4 text-warning-500" />
          <span className="text-small text-warning-600 dark:text-warning-400">
            Polling Mode (15s)
          </span>
        </>
      )}
    </div>

    <Button
      size="sm"
      variant="light"
      isIconOnly
      onClick={onRefresh}
      isLoading={isLoading}
      className="text-default-500 hover:text-default-900"
    >
      <IconRefresh className="w-4 h-4" />
    </Button>
  </div>
));
ConnectionStatus.displayName = "ConnectionStatus";

const ErrorAlert = React.memo<{
  error: string;
  onRetry: () => void;
}>(({ error, onRetry }) => (
  <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 mb-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-danger-500 rounded-full"></div>
        <span className="text-danger-700 dark:text-danger-300 font-medium">
          Connection Error
        </span>
      </div>
      <Button size="sm" color="danger" variant="light" onClick={onRetry}>
        Retry
      </Button>
    </div>
    <p className="text-danger-600 dark:text-danger-400 text-small mt-2 ml-4">
      {error}
    </p>
  </div>
));
ErrorAlert.displayName = "ErrorAlert";

const Monitor: React.FC<MonitorProps> = () => {
  const router = useRouter();

  const handleError = useCallback((error: Error) => {
    logger.error("VPS Monitor Error:", error);
  }, []);

  const handleUpdate = useCallback((newData: MonitorData) => {
    logger.log("VPS data updated:", newData.summary);
  }, []);

  const { data, isLoading, error, refetch, isConnected } = useVPSMonitor({
    refreshInterval: 15000,
    enableSSE: true,
    onError: handleError,
    onUpdate: handleUpdate,
  });

  const handleSubscribe = useCallback(
    async (model: number, datacenter: string) => {
      try {
        logger.log(`Subscribe to Model ${model} in ${datacenter}`);
      } catch (error) {
        logger.error("Subscription error:", error);
      }
    },
    []
  );

  const handleOrder = useCallback((model: number) => {
    const orderUrl = `https://www.ovhcloud.com/en/vps/`;
    window.open(orderUrl, "_blank", "noopener,noreferrer");
  }, []);

  const handleSubscriptionSuccess = useCallback(
    (data: any) => {
      logger.log("Subscription created successfully:", data);
      router.push("/manage");
    },
    [router]
  );

  const handleSubscriptionError = useCallback((error: string) => {
    logger.error("Subscription error:", error);
  }, []);

  useEffect(() => {
    setupDevConsoleHelpers();
  }, []);

  const displayData = useMemo(
    () =>
      data || {
        models: [],
        summary: {
          total: 0,
          available: 0,
          outOfStock: 0,
          availabilityPercentage: 0,
        },
        lastUpdated: new Date().toISOString(),
      },
    [data]
  );

  const skeletonModels = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        model: i + 1,
        name: "",
        price: "",
        specs: { cpu: "", ram: "", storage: "", bandwidth: "" },
        datacenters: [],
        availableCount: 0,
        totalCount: 0,
      })),
    []
  );

  return (
    <section className="relative py-16 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2
            id="monitor-section"
            className="text-3xl md:text-4xl font-bold mb-4"
          >
            Live VPS Availability Monitor
          </h2>
          <p className="text-lg text-default-600 max-w-2xl mx-auto mb-6">
            Real-time monitoring of OVH VPS stock across all models and
            datacenters. Get instant notifications when your preferred
            configuration becomes available.
          </p>

          {/* Connection Status */}
          <ConnectionStatus
            isConnected={isConnected}
            isLoading={isLoading}
            onRefresh={refetch}
          />
        </div>

        {/* Error State */}
        {error && !isLoading && <ErrorAlert error={error} onRetry={refetch} />}

        {/* Monitor Content */}
        <div className="w-full">
          {/* Status Overview */}
          <StatusOverview
            summary={displayData.summary}
            lastUpdated={displayData.lastUpdated}
            isLoading={isLoading}
          />

          {/* VPS Models Grid - Optimized rendering */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {(isLoading ? skeletonModels : displayData.models).map((model) => (
              <VPSModelCard
                key={model.model}
                model={model}
                isLoading={isLoading}
                onSubscribe={handleSubscribe}
                onOrder={handleOrder}
              />
            ))}
          </div>

          {/* Footer Note */}
          {!isLoading && (
            <div className="mt-8 text-center">
              <p className="text-small text-default-500">
                Monitoring updates every 15 seconds • Last update:{" "}
                {getTimeAgo(displayData.lastUpdated)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Newsletter/Subscription Section */}
      <div className="max-w-4xl mx-auto text-center mt-16">
        <h2 className="text-2xl md:text-3xl font-bold mb-4" id="subscribe-form">
          Get Notified When VPS Becomes Available
        </h2>
        <p className="text-lg text-default-600 mb-8">
          Enter your email to receive instant notifications when your preferred
          VPS models become available in your desired datacenters.
        </p>

        {/* Subscription Form Component */}
        <div className="max-w-4xl mx-auto">
          <SubscriptionForm
            onSuccess={handleSubscriptionSuccess}
            onError={handleSubscriptionError}
            className="shadow-2xl"
          />
        </div>
      </div>

      <DevMonitor />
    </section>
  );
};

export default Monitor;
