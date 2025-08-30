"use client";
import React, { memo, useMemo, useCallback } from "react";
import { Card, CardBody, Button, Chip, Divider, Skeleton } from "@heroui/react";
import {
  IconServer,
  IconCpu,
  IconDatabase,
  IconNetwork,
  IconBell,
  IconCheck,
  IconX,
  IconClock,
  IconShield,
  IconArrowRight,
} from "@tabler/icons-react";
import { MemoryStick } from "lucide-react";

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

const STYLE_VARIANTS = {
  available: {
    categoryColor: "primary" as const,
    gradientClass: "from-blue-200/10 via-cyan-200/5 to-blue-200/10",
    borderClass: "border-blue-200/60 dark:border-blue-500/30",
    cardClass: "hover:scale-105",
    statusText: "AVAILABLE",
    buttonText: "Order Now at OVH",
    footerText: "⚡ Available now • Instant deployment",
    iconColor: "text-primary",
    bgColor: "bg-primary/20",
    borderColor: "border-primary/30",
  },
  unavailable: {
    categoryColor: "danger" as const,
    gradientClass: "",
    borderClass: "border-none",
    cardClass: "",
    statusText: "OUT OF STOCK",
    buttonText: "Subscribe to Alerts",
    footerText: "🔔 Get notified when available",
    iconColor: "text-danger",
    bgColor: "bg-danger/20",
    borderColor: "border-danger/30",
  },
} as const;

const parseSpecs = (specs: string) => {
  const parts = specs.split(", ");
  return {
    cpu: parts[0] || "",
    ram: parts[1] || "",
    storage: parts[2] || "",
    bandwidth: "Unlimited",
  };
};

const DatacenterBadge = memo<{
  datacenter: DatacenterStatus;
  onSubscribe: (datacenter: string) => void;
}>(({ datacenter, onSubscribe }) => {
  const dcInfo =
    DATACENTER_INFO[datacenter.datacenter as keyof typeof DATACENTER_INFO];
  const isAvailable = datacenter.status === "available";

  const handleClick = useCallback(() => {
    onSubscribe(datacenter.datacenter);
  }, [onSubscribe, datacenter.datacenter]);

  return (
    <Chip
      size="sm"
      variant={isAvailable ? "flat" : "bordered"}
      color={isAvailable ? "success" : "default"}
      onClick={handleClick}
      className="cursor-pointer transition-all hover:scale-105"
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
});
DatacenterBadge.displayName = "DatacenterBadge";

const LoadingSkeleton = memo(() => (
  <Card className="h-full">
    <CardBody className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <Skeleton className="h-8 w-24 mx-auto" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </CardBody>
  </Card>
));
LoadingSkeleton.displayName = "LoadingSkeleton";

interface VPSModelCardProps {
  model: VPSModelData;
  isLoading?: boolean;
  onSubscribe?: (model: number, datacenter: string) => void;
  onOrder?: (model: number) => void;
}

const VPSModelCard = memo<VPSModelCardProps>(
  ({ model, isLoading = false, onSubscribe, onOrder }) => {
    const computedValues = useMemo(() => {
      if (isLoading) return null;

      const config = VPS_CONFIGS[model.model as keyof typeof VPS_CONFIGS];
      const specs = parseSpecs(config?.specs || "");
      const hasAvailability = model.availableCount > 0;
      const styleVariant =
        STYLE_VARIANTS[hasAvailability ? "available" : "unavailable"];
      const isHighAvailability = model.availableCount > 3;

      return {
        config,
        specs,
        hasAvailability,
        styleVariant,
        isHighAvailability,
      };
    }, [model.model, model.availableCount, isLoading]);

    const handleSubscribe = useCallback(
      (datacenter: string) => {
        onSubscribe?.(model.model, datacenter);
      },
      [onSubscribe, model.model]
    );

    const handleOrderClick = useCallback(() => {
      onOrder?.(model.model);
    }, [onOrder, model.model]);

    const handleScrollToForm = useCallback(() => {
      const el = document.getElementById("subscribe-form");
      el?.scrollIntoView({ behavior: "smooth" });
    }, []);

    if (isLoading || !computedValues) {
      return <LoadingSkeleton />;
    }

    const { config, specs, hasAvailability, styleVariant, isHighAvailability } =
      computedValues;

    return (
      <div
        className={`relative transition-all duration-300 ${styleVariant.cardClass}`}
      >
        {/* High availability badge */}
        {isHighAvailability && (
          <div className="absolute -top-3 left-0 right-0 mx-auto w-fit z-10">
            <Chip
              className="font-bold text-white shadow-lg"
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
          className={`h-full backdrop-blur-xl bg-white/5 dark:bg-black/5 shadow-2xl 
          border-2 ${styleVariant.borderClass} 
          hover:shadow-3xl transition-all duration-500 overflow-hidden relative group`}
        >
          {/* Background gradient */}
          <div
            className={`absolute inset-0 bg-gradient-to-br ${styleVariant.gradientClass} 
            pointer-events-none transition-opacity duration-500 group-hover:opacity-80`}
          />

          {/* Status badge */}
          <div className="absolute top-4 right-4 z-20">
            <Chip
              className="font-semibold backdrop-blur-sm"
              color={styleVariant.categoryColor}
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
              {styleVariant.statusText}
            </Chip>
          </div>

          <CardBody className="p-6 relative z-10 flex flex-col justify-between h-full">
            <div
              className={`transition-all duration-300 ${hasAvailability ? "" : "opacity-60 grayscale"}`}
            >
              {/* Header */}
              <div className="relative mb-4">
                <div className="absolute left-0 top-0">
                  <div
                    className={`w-10 h-10 rounded-xl ${styleVariant.bgColor} backdrop-blur-sm 
                  flex items-center justify-center border ${styleVariant.borderColor}`}
                  >
                    <IconServer
                      className={`w-5 h-5 ${styleVariant.iconColor}`}
                    />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold leading-tight mb-1">
                    {config.name}
                  </h3>
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

              {/* Price */}
              <div className="text-center mb-6">
                <div
                  className={`text-3xl font-bold ${styleVariant.iconColor} mb-1`}
                >
                  {config.price}
                  <span className="text-lg font-normal text-default-600">
                    /month
                  </span>
                </div>
                <p className="text-sm text-default-600">
                  Starting price at OVH
                </p>
              </div>

              <Divider className="my-4" />

              {/* Specs grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-default-100/20 backdrop-blur-sm rounded-xl p-3 text-center border border-primary/10">
                  <IconCpu
                    className={`w-5 h-5 mx-auto mb-1 ${styleVariant.iconColor}`}
                  />
                  <p className="text-xs text-default-600">CPU</p>
                  <p className="font-bold text-sm">{specs.cpu}</p>
                </div>
                <div className="bg-default-100/20 backdrop-blur-sm rounded-xl p-3 text-center border border-primary/10">
                  <MemoryStick
                    className={`w-5 h-5 mx-auto mb-1 ${styleVariant.iconColor}`}
                  />
                  <p className="text-xs text-default-600">RAM</p>
                  <p className="font-bold text-sm">{specs.ram}</p>
                </div>
                <div className="bg-default-100/20 backdrop-blur-sm rounded-xl p-3 text-center border border-primary/10">
                  <IconDatabase
                    className={`w-5 h-5 mx-auto mb-1 ${styleVariant.iconColor}`}
                  />
                  <p className="text-xs text-default-600">Storage</p>
                  <p className="font-bold text-sm">{specs.storage}</p>
                </div>
                <div className="bg-default-100/20 backdrop-blur-sm rounded-xl p-3 text-center border border-primary/10">
                  <IconNetwork
                    className={`w-5 h-5 mx-auto mb-1 ${styleVariant.iconColor}`}
                  />
                  <p className="text-xs text-default-600">Network</p>
                  <p className="font-bold text-sm">{specs.bandwidth}</p>
                </div>
              </div>

              {/* Features list */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <IconServer className={`w-4 h-4 ${styleVariant.iconColor}`} />
                  <span className="text-sm font-medium">
                    {config.name} Configuration
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <IconShield className={`w-4 h-4 ${styleVariant.iconColor}`} />
                  <span className="text-sm font-medium">
                    Anti-DDoS Protection
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <IconClock className={`w-4 h-4 ${styleVariant.iconColor}`} />
                  <span className="text-sm font-medium">99.99% SLA Uptime</span>
                </div>
              </div>

              {/* Datacenters */}
              <div className="mb-4">
                <p className="text-small text-default-600 mb-2 font-medium">
                  Available Datacenters ({model.availableCount}/
                  {model.totalCount})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {model.datacenters.map((dc) => (
                    <DatacenterBadge
                      key={dc.datacenter}
                      datacenter={dc}
                      onSubscribe={handleSubscribe}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-3 mt-auto">
              {hasAvailability ? (
                <Button
                  className="w-full bg-gradient-to-tl from-sky-200 via-blue-100 to-indigo-200 
                  dark:bg-gradient-to-tl dark:from-blue-950 dark:via-slate-900 dark:to-indigo-900 
                  text-slate-800 dark:text-white font-semibold shadow-lg
                  transition-all hover:scale-105 shadow-blue-300/50 dark:shadow-blue-900/50"
                  endContent={<IconArrowRight className="w-4 h-4" />}
                  onClick={handleOrderClick}
                  size="lg"
                  variant="shadow"
                >
                  {styleVariant.buttonText}
                </Button>
              ) : (
                <Button
                  className={`w-full font-semibold backdrop-blur-sm transition-all duration-300 
                  border-2 border-${styleVariant.categoryColor} hover:bg-${styleVariant.categoryColor}/10`}
                  color={styleVariant.categoryColor}
                  endContent={<IconBell className="w-4 h-4" />}
                  onClick={handleScrollToForm}
                  size="lg"
                  variant="bordered"
                >
                  {styleVariant.buttonText}
                </Button>
              )}
              <p className="text-xs text-center text-default-500">
                {styleVariant.footerText}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }
);

VPSModelCard.displayName = "VPSModelCard";

export default VPSModelCard;
