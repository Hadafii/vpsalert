import { NextRequest, NextResponse } from "next/server";
import { getAllStatus } from "@/lib/queries";
import { DatacenterStatus } from "@/lib/queries";
import { logger } from "@/lib/logs";

const CACHE_TTL = 30;

const cache = new Map<string, { data: any; timestamp: number }>();

const getCachedData = (key: string) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  cache.set(key, { data, timestamp: Date.now() });

  if (cache.size > 100) {
    const keys = Array.from(cache.keys());
    const oldestKey = keys[0];
    cache.delete(oldestKey);
  }
};

const groupStatusByModel = (statuses: DatacenterStatus[]) => {
  const grouped: Record<number, DatacenterStatus[]> = {};

  statuses.forEach((status) => {
    if (!grouped[status.model]) {
      grouped[status.model] = [];
    }
    grouped[status.model].push(status);
  });

  return grouped;
};

const calculateSummary = (statuses: DatacenterStatus[]) => {
  const total = statuses.length;
  const available = statuses.filter((s) => s.status === "available").length;
  const outOfStock = total - available;

  return {
    total,
    available,
    outOfStock,
    availabilityPercentage:
      total > 0 ? Math.round((available / total) * 100) : 0,
  };
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "grouped";
    const includeSummary = searchParams.get("summary") === "true";

    const cacheKey = `all-status-${format}-${includeSummary}`;
    const cachedData = getCachedData(cacheKey);

    if (cachedData) {
      return NextResponse.json(cachedData, {
        headers: {
          "Cache-Control": `s-maxage=${CACHE_TTL}, stale-while-revalidate=60`,
          "X-Cache": "HIT",
        },
      });
    }

    const statuses = await getAllStatus();

    let responseData: any = {
      lastUpdated: new Date().toISOString(),
      count: statuses.length,
    };

    if (format === "grouped") {
      responseData.models = groupStatusByModel(statuses);
    } else {
      responseData.statuses = statuses;
    }

    if (includeSummary) {
      responseData.summary = calculateSummary(statuses);
    }

    setCachedData(cacheKey, responseData);

    return NextResponse.json(responseData, {
      headers: {
        "Cache-Control": `s-maxage=${CACHE_TTL}, stale-while-revalidate=60`,
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    logger.error("Error fetching VPS status:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch VPS status",
        message: "Please try again later",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function HEAD() {
  try {
    await getAllStatus();

    return new NextResponse(null, {
      status: 200,
      headers: {
        "X-Status": "healthy",
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
