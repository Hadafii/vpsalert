// components/Monitor.tsx
"use client";
import { logger } from "@/lib/logs";
import React from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Badge,
  Button,
  Chip,
  Divider,
  Progress,
  Skeleton,
} from "@heroui/react";
import {
  IconServer,
  IconCpu,
  IconDatabase,
  IconNetwork,
  IconBell,
  IconCheck,
  IconX,
  IconClock,
  IconTrendingUp,
  IconRefresh,
  IconWifi,
  IconWifiOff,
} from "@tabler/icons-react";
import { MemoryStick } from "lucide-react";
import { useVPSMonitor } from "@/hooks/useVPSMonitor";
import { useCallback } from "react";
import SubscriptionForm from "./SubscriptionForm";
import { useRouter } from "next/navigation";
// ====================================
// TYPE DEFINITIONS
// ====================================

export interface DatacenterStatus {
  id: number;
  model: number;
  datacenter: string;
  status: "available" | "out-of-stock";
  last_checked: string;
  last_changed: string | null;
}

export interface VPSModelData {
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

// Remove the old MonitorProps interface and create new one
interface MonitorProps {
  // This component now handles its own data fetching
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

const DATACENTER_INFO = {
  GRA: { name: "Gravelines", country: "France", flag: "🇫🇷" },
  SBG: { name: "Strasbourg", country: "France", flag: "🇫🇷" },
  BHS: { name: "Beauharnois", country: "Canada", flag: "🇨🇦" },
  WAW: { name: "Warsaw", country: "Poland", flag: "🇵🇱" },
  UK: { name: "London", country: "United Kingdom", flag: "🇬🇧" },
  DE: { name: "Frankfurt", country: "Germany", flag: "🇩🇪" },
  FR: { name: "Roubaix", country: "France", flag: "🇫🇷" },
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

// ====================================
// SUB-COMPONENTS
// ====================================

const StatusOverview: React.FC<{
  summary: MonitorData["summary"];
  lastUpdated: string;
  isLoading: boolean;
}> = ({ summary, lastUpdated, isLoading }) => (
  <Card className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-none shadow-lg">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
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
          <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
            <IconServer className="w-6 h-6 text-success-600 dark:text-success-400" />
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
);

const DatacenterBadge: React.FC<{
  datacenter: DatacenterStatus;
  onSubscribe?: (datacenter: string) => void;
  isSmall?: boolean;
}> = ({ datacenter, onSubscribe, isSmall = false }) => {
  const dcInfo =
    DATACENTER_INFO[datacenter.datacenter as keyof typeof DATACENTER_INFO];
  const isAvailable = datacenter.status === "available";

  return (
    <Chip
      size={isSmall ? "sm" : "md"}
      variant={isAvailable ? "flat" : "bordered"}
      color={isAvailable ? "success" : "default"}
      className={`cursor-pointer transition-all hover:scale-105 ${
        isAvailable ? "bg-success-50 dark:bg-success-900/20" : ""
      }`}
      onClick={() => onSubscribe?.(datacenter.datacenter)}
      startContent={
        isAvailable ? (
          <IconCheck className="w-3 h-3" />
        ) : (
          <IconClock className="w-3 h-3" />
        )
      }
    >
      <span className="font-medium">
        {dcInfo?.flag} {datacenter.datacenter}
      </span>
    </Chip>
  );
};

const VPSModelCard: React.FC<{
  model: VPSModelData;
  isLoading: boolean;
  onSubscribe?: (model: number, datacenter: string) => void;
  onOrder?: (model: number) => void;
}> = ({ model, isLoading, onSubscribe, onOrder }) => {
  const config = VPS_CONFIGS[model.model as keyof typeof VPS_CONFIGS];
  const specs = parseSpecs(config?.specs || "");
  const hasAvailability = model.availableCount > 0;

  const handleSubscribe = (datacenter: string) => {
    onSubscribe?.(model.model, datacenter);
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardBody>
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="space-y-3 mb-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="h-10 w-full" />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card
      className={`h-full transition-all duration-300 hover:shadow-xl ${
        hasAvailability
          ? "border-success-200 dark:border-success-800 shadow-success-100 dark:shadow-success-900/20"
          : "border-default-200 dark:border-default-700"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start w-full">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                hasAvailability
                  ? "bg-success-100 dark:bg-success-900/30"
                  : "bg-default-100 dark:bg-default-800"
              }`}
            >
              <IconServer
                className={`w-5 h-5 ${
                  hasAvailability
                    ? "text-success-600 dark:text-success-400"
                    : "text-default-600 dark:text-default-400"
                }`}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{config?.name}</h3>
              <p className="text-small text-primary-600 dark:text-primary-400 font-medium">
                From {config?.price}
              </p>
            </div>
          </div>
          <Badge
            content={model.availableCount}
            color={hasAvailability ? "success" : "danger"}
            placement="top-right"
            isInvisible={model.availableCount === 0}
          >
            <Chip
              size="sm"
              color={hasAvailability ? "success" : "danger"}
              variant="flat"
              startContent={
                hasAvailability ? (
                  <IconCheck className="w-3 h-3" />
                ) : (
                  <IconX className="w-3 h-3" />
                )
              }
            >
              {hasAvailability ? "Available" : "Out of Stock"}
            </Chip>
          </Badge>
        </div>
      </CardHeader>

      <CardBody className="pt-0">
        {/* Specifications */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2">
            <IconCpu className="w-4 h-4 text-default-500" />
            <span className="text-small text-default-600">{specs.cpu}</span>
          </div>
          <div className="flex items-center gap-2">
            <MemoryStick className="w-4 h-4 text-default-500" />
            <span className="text-small text-default-600">{specs.ram}</span>
          </div>
          <div className="flex items-center gap-2">
            <IconDatabase className="w-4 h-4 text-default-500" />
            <span className="text-small text-default-600">{specs.storage}</span>
          </div>
          <div className="flex items-center gap-2">
            <IconNetwork className="w-4 h-4 text-default-500" />
            <span className="text-small text-default-600">
              {specs.bandwidth}
            </span>
          </div>
        </div>

        <Divider className="my-3" />

        {/* Available Datacenters */}
        <div className="mb-4">
          <p className="text-small text-default-600 mb-2 font-medium">
            Available Datacenters ({model.availableCount}/{model.totalCount})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {model.datacenters.map((dc) => (
              <DatacenterBadge
                key={dc.datacenter}
                datacenter={dc}
                onSubscribe={handleSubscribe}
                isSmall
              />
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-auto">
          {hasAvailability ? (
            <Button
              color="success"
              variant="solid"
              className="flex-1 font-medium"
              startContent={<IconCheck className="w-4 h-4" />}
              onClick={() => onOrder?.(model.model)}
            >
              Order Now
            </Button>
          ) : (
            <Button
              color="primary"
              variant="bordered"
              className="flex-1"
              startContent={<IconBell className="w-4 h-4" />}
              onClick={() => onSubscribe?.(model.model, "")}
            >
              Subscribe to Alerts
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

// ====================================
// MAIN COMPONENT
// ====================================

const Monitor: React.FC<MonitorProps> = () => {
  const router = useRouter();

  // Stable callbacks to prevent unnecessary re-renders
  const handleError = useCallback((error: Error) => {
    logger.error("VPS Monitor Error:", error);
    // You could show a toast notification here
  }, []);

  const handleUpdate = useCallback((newData: MonitorData) => {
    logger.log("VPS data updated:", newData.summary);
    // You could trigger notifications or analytics here
  }, []);

  // VPS Monitor data fetching - moved from page.tsx
  const { data, isLoading, error, refetch, isConnected } = useVPSMonitor({
    refreshInterval: 15000, // 15 seconds polling
    enableSSE: true, // Enable real-time updates
    onError: handleError,
    onUpdate: handleUpdate,
  });

  // Handle subscription to alerts
  const handleSubscribe = async (model: number, datacenter: string) => {
    try {
      // TODO: Implement subscription logic
      logger.log(`Subscribe to Model ${model} in ${datacenter}`);
      // You can call your subscription API here
    } catch (error) {
      logger.error("Subscription error:", error);
    }
  };

  // Handle order VPS
  const handleOrder = (model: number) => {
    // Redirect to OVH order page
    const orderUrl = `https://www.ovhcloud.com/en/vps/`;
    window.open(orderUrl, "_blank", "noopener,noreferrer");
  };

  // Handle subscription success
  const handleSubscriptionSuccess = useCallback(
    (data: any) => {
      logger.log("Subscription created successfully:", data);
      // Redirect to management page or show success message
      router.push("/manage");
    },
    [router]
  );

  // Handle subscription error
  const handleSubscriptionError = useCallback((error: string) => {
    logger.error("Subscription error:", error);
    // Error is already handled in the SubscriptionForm component
  }, []);

  // Fallback data when loading or no data
  const displayData = data || {
    models: [],
    summary: {
      total: 0,
      available: 0,
      outOfStock: 0,
      availabilityPercentage: 0,
    },
    lastUpdated: new Date().toISOString(),
  };

  return (
    <section className="relative py-16 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Live VPS Availability Monitor
          </h2>
          <p className="text-lg text-default-600 max-w-2xl mx-auto mb-6">
            Real-time monitoring of OVH VPS stock across all models and
            datacenters. Get instant notifications when your preferred
            configuration becomes available.
          </p>

          {/* Status Bar */}
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
              onClick={refetch}
              isLoading={isLoading}
              className="text-default-500 hover:text-default-900"
            >
              <IconRefresh className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-danger-500 rounded-full"></div>
                <span className="text-danger-700 dark:text-danger-300 font-medium">
                  Connection Error
                </span>
              </div>
              <Button
                size="sm"
                color="danger"
                variant="light"
                onClick={refetch}
              >
                Retry
              </Button>
            </div>
            <p className="text-danger-600 dark:text-danger-400 text-small mt-2 ml-4">
              {error}
            </p>
          </div>
        )}

        {/* Monitor Content */}
        <div className="w-full">
          {/* Status Overview */}
          <StatusOverview
            summary={displayData.summary}
            lastUpdated={displayData.lastUpdated}
            isLoading={isLoading}
          />

          {/* VPS Models Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {(isLoading
              ? Array.from({ length: 6 }, (_, i) => ({
                  model: i + 1,
                  name: "",
                  price: "",
                  specs: { cpu: "", ram: "", storage: "", bandwidth: "" },
                  datacenters: [],
                  availableCount: 0,
                  totalCount: 0,
                }))
              : displayData.models
            ).map((model: VPSModelData) => (
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
        <h2 className="text-2xl md:text-3xl font-bold mb-4">
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
    </section>
  );
};

export default Monitor;
