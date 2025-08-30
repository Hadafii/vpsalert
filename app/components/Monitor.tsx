"use client";
import { logger } from "@/lib/logs";
import React from "react";
import { useEffect } from "react";
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
  IconShield,
  IconArrowRight,
} from "@tabler/icons-react";
import { MemoryStick } from "lucide-react";
import { useVPSMonitor } from "@/hooks/useVPSMonitor";
import { useCallback } from "react";
import SubscriptionForm from "./SubscriptionForm";
import { useRouter } from "next/navigation";
import DevMonitor, { setupDevConsoleHelpers } from "./DevMonitor";

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

interface MonitorProps {}

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

  SGP: { name: "Singapore", country: "Singapore", flag: "🇸🇬" },
  SYD: { name: "Sydney", country: "Australia", flag: "🇦🇺" },
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

const StatusOverview: React.FC<{
  summary: MonitorData["summary"];
  lastUpdated: string;
  isLoading: boolean;
}> = ({ summary, lastUpdated, isLoading }) => (
  <Card className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20  border-primary">
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
          <div className="p-2 bg-success-100  rounded-lg">
            <IconServer className="w-6 h-6 text-success " />
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

  const getCategoryColor = ():
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger" => {
    if (hasAvailability) return "primary";
    return "danger";
  };

  const getCategoryGradient = (): string => {
    if (hasAvailability) {
      return "from-blue-200/10 via-cyan-200/5 to-blue-200/10";
    }
    return "";
  };

  const getCategoryBorder = (): string => {
    if (hasAvailability) {
      return "border-blue-200/60 dark:border-blue-500/30";
    }
    return "border-blue-200/60 dark:border-blue-500/30";
  };

  const handleSubscribe = (datacenter: string) => {
    onSubscribe?.(model.model, datacenter);
  };

  const handleOrderClick = () => {
    onOrder?.(model.model);
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

  const categoryColor = getCategoryColor();
  const gradientClass = getCategoryGradient();
  const borderClass = getCategoryBorder();

  return (
    <div className="relative hover:scale-105 transition-all">
      {/* Popular/Featured Badge */}
      {model.availableCount > 3 && (
        <div className="absolute -top-3 left-0 right-0 mx-auto w-fit z-10">
          <Chip
            className="font-bold text-white"
            color="success"
            size="sm"
            startContent={<IconCheck className="w-3 h-3" />}
            variant="shadow"
          >
            HIGH AVAILABILITY
          </Chip>
        </div>
      )}

      <Card
        className={`h-full backdrop-blur-xl bg-white/5 dark:bg-slate-800/40 shadow-2xl 
          border-2 ${borderClass} ${hasAvailability ? "" : "opacity-60 grayscale"}
          hover:shadow-3xl transition-all duration-500 overflow-hidden relative group`}
      >
        {/* Gradient Background Overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${gradientClass} pointer-events-none transition-all duration-500 group-hover:opacity-80`}
        />

        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-20">
          <Chip
            className="font-semibold backdrop-blur-sm"
            color={categoryColor}
            size="sm"
            startContent={
              hasAvailability ? (
                <IconCheck className="w-3 h-3" />
              ) : (
                <IconX className="w-3 h-3" />
              )
            }
            variant="flat"
          >
            {hasAvailability ? "AVAILABLE" : "OUT OF STOCK"}
          </Chip>
        </div>

        <CardBody className="p-6 relative z-10 flex flex-col justify-between h-full">
          {/* Header Section */}
          <div>
            <div className="relative mb-4">
              <div className="absolute left-0 top-0">
                <div
                  className={`w-10 h-10 rounded-xl bg-${categoryColor}/20 backdrop-blur-sm flex items-center justify-center border border-${categoryColor}/30`}
                >
                  <IconServer className={`w-5 h-5 text-${categoryColor}`} />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold leading-tight">
                  {config?.name}
                </h3>
                <div className="flex justify-center mt-1">
                  <Chip
                    className="capitalize backdrop-blur-sm"
                    color="primary"
                    size="sm"
                    variant="flat"
                  >
                    VPS Server
                  </Chip>
                </div>
              </div>
            </div>

            {/* Price Section */}
            <div className="text-center mb-6">
              <div className={`text-3xl font-bold text-${categoryColor} mb-1`}>
                {config?.price}
                <span className="text-lg font-normal text-default-600">
                  /month
                </span>
              </div>
              <p className="text-sm text-default-600 mt-1 h-[20px]">
                Starting from this price at OVH
              </p>
            </div>

            <Divider className="my-4" />

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 gap-3 pb-4">
              <div
                className={`bg-default-100/20 backdrop-blur-sm rounded-xl p-3 text-center border border-primary/10`}
              >
                <IconCpu className={`w-5 h-5 mx-auto text-${categoryColor}`} />
                <p className="text-xs text-default-600">CPU</p>
                <p className="font-bold text-sm">{specs.cpu}</p>
              </div>

              <div
                className={`bg-default-100/20 backdrop-blur-sm rounded-xl p-3 text-center border border-primary/10`}
              >
                <MemoryStick
                  className={`w-5 h-5 mx-auto text-${categoryColor}`}
                />
                <p className="text-xs text-default-600">RAM</p>
                <p className="font-bold text-sm">{specs.ram}</p>
              </div>

              <div
                className={`bg-default-100/20 backdrop-blur-sm rounded-xl p-3 text-center border border-primary/10`}
              >
                <IconDatabase
                  className={`w-5 h-5 mx-auto text-${categoryColor}`}
                />
                <p className="text-xs text-default-600">Storage</p>
                <p className="font-bold text-sm">{specs.storage}</p>
              </div>

              <div
                className={`bg-default-100/20 backdrop-blur-sm rounded-xl p-3 text-center border border-primary/10`}
              >
                <IconNetwork
                  className={`w-5 h-5 mx-auto text-${categoryColor}`}
                />
                <p className="text-xs text-default-600">Network</p>
                <p className="font-bold text-sm">Unlimited</p>
              </div>
            </div>

            {/* Additional Features */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <IconServer className={`w-4 h-4 text-${categoryColor}`} />
                <span className="text-sm font-medium">
                  {config?.name} Configuration
                </span>
              </div>

              <div className="flex items-center gap-2">
                <IconShield className={`w-4 h-4 text-${categoryColor}`} />
                <span className="text-sm font-medium">
                  Anti-DDoS Protection
                </span>
              </div>

              <div className="flex items-center gap-2">
                <IconClock className={`w-4 h-4 text-${categoryColor}`} />
                <span className="text-sm font-medium">99.99% SLA Uptime</span>
              </div>
            </div>

            {/* Available Datacenters */}
            <div className="mb-4">
              <p className="text-small text-default-600 mb-2 font-medium">
                Available Datacenters ({model.availableCount}/{model.totalCount}
                )
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
          </div>

          {/* Action Button */}
          <div className="space-y-3">
            {hasAvailability ? (
              <Button
                className={`w-full bg-gradient-to-tl from-sky-200 via-blue-100 to-indigo-200 
     dark:bg-gradient-to-tl dark:from-blue-950 dark:via-slate-900 dark:to-indigo-900 text-slate-800 
             dark:text-white font-semibold shadow-blue-300  dark:shadow-blue-900 transition-all hover:scale-105 shadow-lg`}
                color={categoryColor}
                endContent={<IconArrowRight className="w-4 h-4" />}
                onClick={handleOrderClick}
                size="lg"
                variant="shadow"
              >
                Order Now at OVH
              </Button>
            ) : (
              <Button
                className={`w-full font-semibold backdrop-blur-sm transition-all duration-300 border-2 border-${categoryColor} hover:bg-${categoryColor}/10`}
                color={categoryColor}
                endContent={<IconBell className="w-4 h-4" />}
                onClick={() => onSubscribe?.(model.model, "")}
                size="lg"
                variant="bordered"
              >
                Subscribe to Alerts
              </Button>
            )}

            <p className="text-xs text-center text-default-500">
              {hasAvailability
                ? "⚡ Available now • Instant deployment"
                : "🔔 Get notified when available"}
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

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

  const handleSubscribe = async (model: number, datacenter: string) => {
    try {
      logger.log(`Subscribe to Model ${model} in ${datacenter}`);
    } catch (error) {
      logger.error("Subscription error:", error);
    }
  };

  const handleOrder = (model: number) => {
    const orderUrl = `https://www.ovhcloud.com/en/vps/`;
    window.open(orderUrl, "_blank", "noopener,noreferrer");
  };

  const handleSubscriptionSuccess = useCallback(
    (data: any) => {
      logger.log("Subscription created successfully:", data);

      router.push("/manage");
    },
    [router]
  );
  useEffect(() => {
    setupDevConsoleHelpers();
  }, []);

  const handleSubscriptionError = useCallback((error: string) => {
    logger.error("Subscription error:", error);
  }, []);

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
      <DevMonitor />
    </section>
  );
};

export default Monitor;
