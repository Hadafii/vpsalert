// app/api/status/[model]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getStatusByModel } from "@/lib/queries";
import { DatacenterStatus } from "@/lib/queries";
import { logger } from "@/lib/logs";
// Cache configuration
const CACHE_TTL = 30; // 30 seconds

// In-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();

// VPS model metadata
const VPS_MODELS: Record<
  number,
  { name: string; specs: string; price: string }
> = {
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
};

// Datacenter metadata
const DATACENTER_INFO: Record<
  string,
  { name: string; country: string; flag: string }
> = {
  // Europe
  GRA: { name: "Gravelines", country: "France", flag: "🇫🇷" },
  SBG: { name: "Strasbourg", country: "France", flag: "🇫🇷" },
  RBX: { name: "Roubaix", country: "France", flag: "🇫🇷" },
  WAW: { name: "Warsaw", country: "Poland", flag: "🇵🇱" },
  DE: { name: "Frankfurt", country: "Germany", flag: "🇩🇪" },
  UK: { name: "London", country: "United Kingdom", flag: "🇬🇧" },

  // Americas
  BHS: { name: "Beauharnois", country: "Canada", flag: "🇨🇦" },

  // Asia Pacific - NEW!
  SGP: { name: "Singapore", country: "Singapore", flag: "🇸🇬" },
  SYD: { name: "Sydney", country: "Australia", flag: "🇦🇺" },
};

// Helper function to get cached data
const getCachedData = (key: string) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
    return cached.data;
  }
  return null;
};

// Helper function to set cached data
const setCachedData = (key: string, data: any) => {
  cache.set(key, { data, timestamp: Date.now() });
};

// Validate model parameter
const validateModel = (model: string): number | null => {
  const modelNum = parseInt(model);
  if (isNaN(modelNum) || modelNum < 1 || modelNum > 6) {
    return null;
  }
  return modelNum;
};

// Enrich status data with metadata
const enrichStatusData = (statuses: DatacenterStatus[], model: number) => {
  return statuses.map((status) => ({
    ...status,
    datacenterInfo: DATACENTER_INFO[status.datacenter] || {
      name: status.datacenter,
      country: "Unknown",
      flag: "🌍",
    },
    // Add time since last change
    timeSinceChange: status.last_changed
      ? getTimeSince(new Date(status.last_changed))
      : null,
    // Add time since last check
    timeSinceCheck: getTimeSince(new Date(status.last_checked)),
  }));
};

// Helper function to calculate time since
const getTimeSince = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return "Just now";
};

// Calculate availability statistics for the model
const calculateModelStats = (statuses: DatacenterStatus[]) => {
  const total = statuses.length;
  const available = statuses.filter((s) => s.status === "available").length;
  const outOfStock = total - available;

  const availableDatacenters = statuses
    .filter((s) => s.status === "available")
    .map((s) => s.datacenter);

  const outOfStockDatacenters = statuses
    .filter((s) => s.status === "out-of-stock")
    .map((s) => s.datacenter);

  return {
    total,
    available,
    outOfStock,
    availabilityPercentage:
      total > 0 ? Math.round((available / total) * 100) : 0,
    availableDatacenters,
    outOfStockDatacenters,
    lastUpdate:
      statuses.length > 0
        ? Math.max(...statuses.map((s) => new Date(s.last_checked).getTime()))
        : Date.now(),
  };
};

// GET /api/status/[model]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ model: string }> }
) {
  try {
    const { model: modelParam } = await params;
    const { searchParams } = new URL(request.url);
    const includeMetadata = searchParams.get("metadata") === "true";
    const includeStats = searchParams.get("stats") === "true";

    // Validate model parameter
    const modelNum = validateModel(modelParam);
    if (modelNum === null) {
      return NextResponse.json(
        {
          error: "Invalid model",
          message: "Model must be a number between 1 and 6",
          validModels: [1, 2, 3, 4, 5, 6],
        },
        { status: 400 }
      );
    }

    // Check if model exists in our configuration
    if (!VPS_MODELS[modelNum]) {
      return NextResponse.json(
        {
          error: "Model not found",
          message: `VPS model ${modelNum} is not configured`,
          availableModels: Object.keys(VPS_MODELS).map(Number),
        },
        { status: 404 }
      );
    }

    // Try to get from cache first
    const cacheKey = `model-${modelNum}-${includeMetadata}-${includeStats}`;
    const cachedData = getCachedData(cacheKey);

    if (cachedData) {
      return NextResponse.json(cachedData, {
        headers: {
          "Cache-Control": `s-maxage=${CACHE_TTL}, stale-while-revalidate=60`,
          "X-Cache": "HIT",
        },
      });
    }

    // Fetch from database
    const statuses = await getStatusByModel(modelNum);

    // Prepare response data
    let responseData: any = {
      model: modelNum,
      modelInfo: VPS_MODELS[modelNum],
      lastUpdated: new Date().toISOString(),
      count: statuses.length,
    };

    if (includeMetadata) {
      responseData.statuses = enrichStatusData(statuses, modelNum);
    } else {
      responseData.statuses = statuses;
    }

    if (includeStats) {
      responseData.statistics = calculateModelStats(statuses);
    }

    // Add quick availability summary
    responseData.quickSummary = {
      availableCount: statuses.filter((s) => s.status === "available").length,
      totalCount: statuses.length,
      hasAvailability: statuses.some((s) => s.status === "available"),
    };

    // Cache the response
    setCachedData(cacheKey, responseData);

    return NextResponse.json(responseData, {
      headers: {
        "Cache-Control": `s-maxage=${CACHE_TTL}, stale-while-revalidate=60`,
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    logger.error("Error fetching model status:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch model status",
        message: "Please try again later",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// HEAD /api/status/[model] - for health checks
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ model: string }> }
) {
  try {
    const { model: modelParam } = await params;
    const modelNum = validateModel(modelParam);

    if (modelNum === null || !VPS_MODELS[modelNum]) {
      return new NextResponse(null, { status: 404 });
    }

    // Quick health check
    await getStatusByModel(modelNum);

    return new NextResponse(null, {
      status: 200,
      headers: {
        "X-Status": "healthy",
        "X-Model": modelNum.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        "X-Status": "unhealthy",
        "Cache-Control": "no-cache",
      },
    });
  }
}

// OPTIONS /api/status/[model] - CORS handling
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
