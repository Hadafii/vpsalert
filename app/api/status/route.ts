// app/api/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAllStatus } from "@/lib/queries";
import { DatacenterStatus } from "@/lib/queries";
import { logger } from "@/lib/logs";
// Cache configuration
const CACHE_TTL = 30; // 30 seconds

// In-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();

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

  // Clean old cache entries (keep max 100 entries)
  if (cache.size > 100) {
    const keys = Array.from(cache.keys());
    const oldestKey = keys[0];
    cache.delete(oldestKey);
  }
};

// Group status by model for better frontend consumption
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

// Calculate summary statistics
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

// GET /api/status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "grouped"; // 'grouped' | 'flat'
    const includeSummary = searchParams.get("summary") === "true";

    // Try to get from cache first
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

    // Fetch from database
    const statuses = await getAllStatus();

    // Prepare response data
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

    // Cache the response
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

// HEAD /api/status - for health checks
export async function HEAD() {
  try {
    // Quick health check - just check if we can connect to database
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

// OPTIONS /api/status - CORS handling
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
