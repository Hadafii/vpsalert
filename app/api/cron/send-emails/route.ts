import { NextRequest, NextResponse } from "next/server";
import {
  getPendingEmailsGroupedByUser,
  markMultipleEmailsAsSent,
  incrementEmailFailedAttempts,
  getEmailNotificationStats,
  cleanupFailedEmails,
  testDatabaseQuery,
  EmailDigest,
} from "@/lib/queries";
import { sendDigestEmail } from "@/lib/email";
import { logger } from "@/lib/logs";
import { testConnection } from "@/lib/db";

const BATCH_SIZE = 20;
const MAX_PARALLEL_SENDS = 3;
const SEND_DELAY_MS = 1000;
const MAX_PROCESSING_TIME = 240000;

const RATE_LIMITS = {
  perSecond: 3,
  perMinute: 100,
  perHour: 1500,
};

interface RateLimitCounter {
  count: number;
  resetTime: number;
}

const rateLimitCounters = {
  second: { count: 0, resetTime: 0 } as RateLimitCounter,
  minute: { count: 0, resetTime: 0 } as RateLimitCounter,
  hour: { count: 0, resetTime: 0 } as RateLimitCounter,
};

const checkRateLimit = (): boolean => {
  const now = Date.now();

  if (now > rateLimitCounters.second.resetTime) {
    rateLimitCounters.second = { count: 0, resetTime: now + 1000 };
  }
  if (now > rateLimitCounters.minute.resetTime) {
    rateLimitCounters.minute = { count: 0, resetTime: now + 60000 };
  }
  if (now > rateLimitCounters.hour.resetTime) {
    rateLimitCounters.hour = { count: 0, resetTime: now + 3600000 };
  }

  return (
    rateLimitCounters.second.count < RATE_LIMITS.perSecond &&
    rateLimitCounters.minute.count < RATE_LIMITS.perMinute &&
    rateLimitCounters.hour.count < RATE_LIMITS.perHour
  );
};

const incrementRateLimit = () => {
  rateLimitCounters.second.count++;
  rateLimitCounters.minute.count++;
  rateLimitCounters.hour.count++;
};

interface DigestProcessingResult {
  userId: number;
  email: string;
  vpsCount: number;
  emailIds: number[];
  success: boolean;
  error?: string;
  duration: number;
  rateLimited?: boolean;
}

interface ProcessingSummary {
  totalUsers: number;
  totalEmails: number;
  usersProcessed: number;
  emailsSent: number;
  emailsFailed: number;
  rateLimited: number;
  duration: number;
  errors: string[];
}

const processDigestEmail = async (
  digestData: EmailDigest
): Promise<DigestProcessingResult> => {
  const startTime = Date.now();
  const result: DigestProcessingResult = {
    userId: digestData.user_id,
    email: digestData.email,
    vpsCount: digestData.notifications.length,
    emailIds: digestData.notifications.map((n) => n.id),
    success: false,
    duration: 0,
  };

  try {
    if (!checkRateLimit()) {
      result.rateLimited = true;
      result.duration = Date.now() - startTime;
      logger.warn(
        `Rate limited digest for user ${digestData.user_id} (${digestData.email})`
      );
      return result;
    }

    if (!digestData.email || !digestData.unsubscribe_token) {
      throw new Error("Invalid digest data: missing email or token");
    }

    if (!digestData.notifications.length) {
      throw new Error("Invalid digest data: no notifications");
    }

    logger.log(
      `Sending digest email to ${digestData.email} with ${digestData.notifications.length} VPS updates`
    );

    const emailPromise = sendDigestEmail(digestData);
    const timeoutPromise = new Promise<boolean>((_, reject) =>
      setTimeout(() => reject(new Error("Email send timeout")), 45000)
    );

    const sent = await Promise.race([emailPromise, timeoutPromise]);

    if (sent) {
      await markMultipleEmailsAsSent(result.emailIds);
      incrementRateLimit();
      result.success = true;

      logger.log(
        `✅ Digest email sent successfully to ${digestData.email} ` +
          `(${digestData.notifications.length} VPS updates, email IDs: ${result.emailIds.join(", ")})`
      );
    } else {
      throw new Error("Email service returned false");
    }
  } catch (error) {
    const errorMessage = (error as Error).message;
    result.error = errorMessage;

    if (!result.rateLimited) {
      try {
        await Promise.allSettled(
          result.emailIds.map((id) => incrementEmailFailedAttempts(id))
        );
        logger.error(
          `❌ Digest email failed for ${digestData.email}: ${errorMessage}`
        );
      } catch (dbError) {
        logger.error(
          `Failed to update failed attempts for emails ${result.emailIds.join(", ")}:`,
          dbError
        );
      }
    }
  }

  result.duration = Date.now() - startTime;
  return result;
};

const processDigestBatch = async (
  digestList: EmailDigest[]
): Promise<ProcessingSummary> => {
  const startTime = Date.now();
  const summary: ProcessingSummary = {
    totalUsers: digestList.length,
    totalEmails: digestList.reduce(
      (sum, digest) => sum + digest.notifications.length,
      0
    ),
    usersProcessed: 0,
    emailsSent: 0,
    emailsFailed: 0,
    rateLimited: 0,
    duration: 0,
    errors: [],
  };

  if (digestList.length === 0) {
    logger.log("📭 No digest emails to process");
    return summary;
  }

  logger.log(
    `📧 Processing ${digestList.length} digest emails ` +
      `(${summary.totalEmails} total VPS notifications)...`
  );

  for (let i = 0; i < digestList.length; i++) {
    const digest = digestList[i];

    try {
      const result = await processDigestEmail(digest);
      summary.usersProcessed++;

      if (result.success) {
        summary.emailsSent += result.vpsCount;
        logger.log(
          `Progress: ${i + 1}/${digestList.length} - ✅ Sent to ${result.email} ` +
            `(${result.vpsCount} VPS updates)`
        );
      } else if (result.rateLimited) {
        summary.rateLimited += result.vpsCount;
        logger.warn(
          `Progress: ${i + 1}/${digestList.length} - ⚠️ Rate limited ${result.email} ` +
            `(${result.vpsCount} VPS updates deferred)`
        );

        await new Promise((resolve) => setTimeout(resolve, 3000));
      } else {
        summary.emailsFailed += result.vpsCount;
        const errorMsg = `User ${result.userId} (${result.email}): ${result.error}`;
        summary.errors.push(errorMsg);

        logger.error(
          `Progress: ${i + 1}/${digestList.length} - ❌ Failed ${result.email}: ${result.error}`
        );
      }

      if (i < digestList.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
      }

      if (Date.now() - startTime > MAX_PROCESSING_TIME) {
        logger.warn(
          `⏰ Processing timeout reached after ${i + 1} digest emails`
        );
        break;
      }

      if ((i + 1) % 5 === 0 || i === digestList.length - 1) {
        logger.log(
          `Batch progress: ${i + 1}/${digestList.length} processed ` +
            `(${summary.emailsSent} sent, ${summary.emailsFailed} failed, ${summary.rateLimited} rate limited)`
        );
      }
    } catch (error) {
      summary.emailsFailed += digest.notifications.length;
      const errorMsg = `User ${digest.user_id} (${digest.email}): Unexpected error - ${(error as Error).message}`;
      summary.errors.push(errorMsg);
      logger.error(errorMsg);
    }
  }

  summary.duration = Date.now() - startTime;
  return summary;
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const cronSecret =
    request.headers.get("X-Cron-Secret") ||
    request.nextUrl.searchParams.get("secret");

  if (cronSecret !== process.env.CRON_SECRET) {
    logger.warn("❌ Unauthorized email digest cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.log("📬 Starting email digest processing...");

  try {
    logger.log("Step 1: Testing database connection...");
    const dbHealthy = await testConnection();
    if (!dbHealthy) {
      logger.error("❌ Database connection failed");
      return NextResponse.json(
        {
          success: false,
          error: "Database connection failed",
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
        },
        { status: 503 }
      );
    }
    logger.log("✅ Database connection OK");

    logger.log("Step 2: Testing database queries...");
    const queryTest = await testDatabaseQuery();
    if (!queryTest) {
      logger.error("❌ Database query tests failed");
      return NextResponse.json(
        {
          success: false,
          error: "Database query test failed",
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
        },
        { status: 503 }
      );
    }
    logger.log("✅ Database queries OK");

    const { searchParams } = new URL(request.url);
    const requestedBatchSize = parseInt(
      searchParams.get("batch") || BATCH_SIZE.toString()
    );
    const batchSize = Math.min(Math.max(requestedBatchSize, 1), 50);

    logger.log(`Step 3: Fetching up to ${batchSize} user digest emails...`);

    let digestEmails: EmailDigest[] = [];

    try {
      digestEmails = await getPendingEmailsGroupedByUser(batchSize);
      const totalNotifications = digestEmails.reduce(
        (sum, digest) => sum + digest.notifications.length,
        0
      );
      logger.log(
        `✅ Found ${digestEmails.length} users with ${totalNotifications} total VPS notifications ` +
          `(grouped into digest emails)`
      );
    } catch (fetchError) {
      logger.error("❌ Failed to fetch digest emails:", fetchError);
      throw new Error(
        `Failed to fetch digest emails: ${(fetchError as Error).message}`
      );
    }

    if (digestEmails.length === 0) {
      logger.log("📭 No pending digest emails to process");

      const stats = await getEmailNotificationStats().catch(() => ({
        pending: 0,
        sent: 0,
        failed: 0,
        total: 0,
        availableOnly: 0,
      }));

      return NextResponse.json({
        success: true,
        message: "No pending digest emails",
        timestamp: new Date().toISOString(),
        processed: {
          users: 0,
          emails: 0,
        },
        duration: Date.now() - startTime,
        statistics: stats,
        rateLimits: {
          second: `${rateLimitCounters.second.count}/${RATE_LIMITS.perSecond}`,
          minute: `${rateLimitCounters.minute.count}/${RATE_LIMITS.perMinute}`,
          hour: `${rateLimitCounters.hour.count}/${RATE_LIMITS.perHour}`,
        },
      });
    }

    logger.log("Step 4: Processing email digest batch...");
    const summary = await processDigestBatch(digestEmails);

    const userSuccessRate =
      summary.totalUsers > 0
        ? Math.round((summary.usersProcessed / summary.totalUsers) * 100)
        : 0;
    const emailSuccessRate =
      summary.totalEmails > 0
        ? Math.round((summary.emailsSent / summary.totalEmails) * 100)
        : 0;

    const overallSuccess =
      summary.emailsSent > 0 || summary.totalEmails === summary.rateLimited;

    logger.log(
      `📊 Processing completed: ${summary.usersProcessed}/${summary.totalUsers} users (${userSuccessRate}%), ` +
        `${summary.emailsSent}/${summary.totalEmails} VPS notifications sent (${emailSuccessRate}%), ` +
        `${summary.emailsFailed} failed, ${summary.rateLimited} rate limited (${summary.duration}ms)`
    );

    const stats = await getEmailNotificationStats().catch(() => ({
      pending: 0,
      sent: 0,
      failed: 0,
      total: 0,
      availableOnly: 0,
    }));

    if (summary.errors.length > 0) {
      logger.error("Sample digest errors:", summary.errors.slice(0, 3));
    }

    const response = {
      success: overallSuccess,
      timestamp: new Date().toISOString(),
      summary: {
        users: {
          total: summary.totalUsers,
          processed: summary.usersProcessed,
          successRate: userSuccessRate,
        },
        emails: {
          total: summary.totalEmails,
          sent: summary.emailsSent,
          failed: summary.emailsFailed,
          rateLimited: summary.rateLimited,
          successRate: emailSuccessRate,
        },
        duration: summary.duration,
        errors: summary.errors.slice(0, 10),
        statistics: stats,
        rateLimits: {
          second: `${rateLimitCounters.second.count}/${RATE_LIMITS.perSecond}`,
          minute: `${rateLimitCounters.minute.count}/${RATE_LIMITS.perMinute}`,
          hour: `${rateLimitCounters.hour.count}/${RATE_LIMITS.perHour}`,
        },
      },
      message:
        summary.emailsSent > 0
          ? `Successfully sent ${summary.emailsSent} VPS notifications to ${summary.usersProcessed} users (${emailSuccessRate}% success rate)`
          : summary.rateLimited > 0
            ? `Rate limited: ${summary.rateLimited} VPS notifications deferred`
            : summary.totalEmails > 0
              ? `Processing failed: ${summary.emailsFailed} VPS notifications failed`
              : "No emails to process",
    };

    const statusCode = overallSuccess
      ? 200
      : summary.rateLimited > 0
        ? 429
        : 500;

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = (error as Error).message;

    logger.error("❌ Email digest processing failed:", {
      error: errorMessage,
      duration,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Email digest processing failed",
        message: errorMessage,
        timestamp: new Date().toISOString(),
        duration,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const cronSecret = request.headers.get("X-Cron-Secret") || body.secret;

    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    if (body.batch && !isNaN(parseInt(body.batch))) {
      url.searchParams.set(
        "batch",
        Math.min(parseInt(body.batch), 50).toString()
      );
    }

    const newRequest = new NextRequest(url, {
      method: "GET",
      headers: request.headers,
    });

    return GET(newRequest);
  } catch (error) {
    logger.error("POST request error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Invalid POST request",
        message: (error as Error).message,
      },
      { status: 400 }
    );
  }
}

export async function HEAD() {
  try {
    const dbHealthy = await testConnection();
    const queryHealthy = await testDatabaseQuery();
    const stats = await getEmailNotificationStats().catch(() => null);

    return new Response(null, {
      status: dbHealthy && queryHealthy ? 200 : 503,
      headers: {
        "X-Email-Status": dbHealthy && queryHealthy ? "ready" : "unhealthy",
        "X-DB-Connection": dbHealthy ? "ok" : "failed",
        "X-DB-Queries": queryHealthy ? "ok" : "failed",
        "X-Pending-Count": stats?.pending.toString() || "unknown",
        "X-Available-Only": stats?.availableOnly.toString() || "unknown",
        "X-Rate-Limit-Hour": `${rateLimitCounters.hour.count}/${RATE_LIMITS.perHour}`,
        "X-Rate-Limit-Minute": `${rateLimitCounters.minute.count}/${RATE_LIMITS.perMinute}`,
        "X-Last-Check": new Date().toISOString(),
        "X-Mode": "digest",
      },
    });
  } catch (error) {
    return new Response(null, {
      status: 503,
      headers: {
        "X-Email-Status": "error",
        "X-Error": (error as Error).message,
        "X-Mode": "digest",
      },
    });
  }
}

export async function DELETE(request: NextRequest) {
  const cronSecret = request.headers.get("X-Cron-Secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    logger.log("🧹 Cleaning up failed email notifications...");

    const cleanedCount = await cleanupFailedEmails(24);

    logger.log(`✅ Cleaned up ${cleanedCount} failed email notifications`);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${cleanedCount} failed email notifications`,
      cleaned: cleanedCount,
      timestamp: new Date().toISOString(),
      mode: "digest",
    });
  } catch (error) {
    logger.error("❌ Failed to cleanup emails:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Cleanup failed",
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
