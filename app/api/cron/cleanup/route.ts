// app/api/cron/cleanup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cleanupRateLimits } from "@/lib/db-rate-limiter";
import { logger } from "@/lib/logs";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Security check
  const cronSecret =
    request.headers.get("X-Cron-Secret") ||
    request.nextUrl.searchParams.get("secret");

  if (cronSecret !== process.env.CRON_SECRET) {
    logger.warn("Unauthorized cleanup cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.log("Starting database cleanup tasks...");

  try {
    const results = {
      rate_limits_cleaned: 0,
      duration: 0,
    };

    // Cleanup old rate limit entries (older than 24 hours)
    const rateLimitsRemoved = await cleanupRateLimits(24);
    results.rate_limits_cleaned = rateLimitsRemoved;

    // Add more cleanup tasks here as needed
    // - Old email notifications
    // - Expired verification tokens
    // - Old status history beyond retention period

    results.duration = Date.now() - startTime;

    logger.log(
      `Cleanup completed: ${rateLimitsRemoved} rate limit entries removed (${results.duration}ms)`
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      message: `Cleaned up ${rateLimitsRemoved} old rate limit entries`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Database cleanup failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Cleanup failed",
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        duration,
      },
      { status: 500 }
    );
  }
}

// POST method for manual cleanup with specific parameters
export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get("X-Cron-Secret");
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const olderThanHours = body.olderThanHours || 24;

    // Validate parameter
    if (olderThanHours < 1 || olderThanHours > 8760) {
      // Max 1 year
      return NextResponse.json(
        {
          error: "Invalid parameter",
          message: "olderThanHours must be between 1 and 8760 (1 year)",
        },
        { status: 400 }
      );
    }

    const rateLimitsRemoved = await cleanupRateLimits(olderThanHours);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        rate_limits_cleaned: rateLimitsRemoved,
        older_than_hours: olderThanHours,
      },
      message: `Cleaned up ${rateLimitsRemoved} rate limit entries older than ${olderThanHours} hours`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Manual cleanup failed",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
