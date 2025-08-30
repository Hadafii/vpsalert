import { NextRequest, NextResponse } from "next/server";
import { getStatusByModel } from "@/lib/queries";
import { DatacenterStatus } from "@/lib/queries";
import { logger } from "@/lib/logs";

const CACHE_TTL = 30;

const cache = new Map<string, { data: any; timestamp: number }>();

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

const DATACENTER_INFO: Record<
  string,
  { name: string; country: string; flag: string }
> = {
  GRA: { name: "Gravelines", country: "France", flag: "🇫🇷" },
  SBG: { name: "Strasbourg", country: "France", flag: "🇫🇷" },
  RBX: { name: "Roubaix", country: "France", flag: "🇫🇷" },
  WAW: { name: "Warsaw", country: "Poland", flag: "🇵🇱" },
  DE: { name: "Frankfurt", country: "Germany", flag: "🇩🇪" },
  UK: { name: "London", country: "United Kingdom", flag: "🇬🇧" },

  BHS: { name: "Beauharnois", country: "Canada", flag: "🇨🇦" },

  SGP: { name: "Singapore", country: "Singapore", flag: "🇸🇬" },
  SYD: { name: "Sydney", country: "Australia", flag: "🇦🇺" },
};

const getCachedData = (key: string) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  cache.set(key, { data, timestamp: Date.now() });
};

const validateModel = (model: string): number | null => {
  const modelNum = parseInt(model);
  if (isNaN(modelNum) || modelNum < 1 || modelNum > 6) {
    return null;
  }
  return modelNum;
};

const enrichStatusData = (statuses: DatacenterStatus[], model: number) => {
  return statuses.map((status) => ({
    ...status,
    datacenterInfo: DATACENTER_INFO[status.datacenter] || {
      name: status.datacenter,
      country: "Unknown",
      flag: "🌍",
    },

    timeSinceChange: status.last_changed
      ? getTimeSince(new Date(status.last_changed))
      : null,

    timeSinceCheck: getTimeSince(new Date(status.last_checked)),
  }));
};

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ model: string }> }
) {
  try {
    const { model: modelParam } = await params;
    const { searchParams } = new URL(request.url);
    const includeMetadata = searchParams.get("metadata") === "true";
    const includeStats = searchParams.get("stats") === "true";

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

    const statuses = await getStatusByModel(modelNum);

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

    responseData.quickSummary = {
      availableCount: statuses.filter((s) => s.status === "available").length,
      totalCount: statuses.length,
      hasAvailability: statuses.some((s) => s.status === "available"),
    };

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
