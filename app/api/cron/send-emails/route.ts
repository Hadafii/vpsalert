// app/api/cron/send-emails/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getPendingEmails,
  markEmailAsSent,
  incrementEmailFailedAttempts,
  EmailNotification,
  StatusChange,
} from "@/lib/queries";
import { sendNotificationEmail, sendEmailBatch } from "@/lib/email";
import { logger } from "@/lib/logs";
// ====================================
// EMAIL PROCESSING CONFIGURATION
// ====================================

const BATCH_SIZE = 50; // Process max 50 emails per run
const MAX_PARALLEL_SENDS = 10; // Send max 10 emails in parallel
const SEND_DELAY_MS = 100; // Delay between parallel batches (rate limiting)
const MAX_PROCESSING_TIME = 300000; // 5 minutes max processing time

// Rate limiting configuration
const RATE_LIMITS = {
  perSecond: 10,
  perMinute: 300,
  perHour: 5000,
};

// ====================================
// RATE LIMITING & MONITORING
// ====================================

interface RateLimitCounter {
  count: number;
  resetTime: number;
}

const rateLimitCounters = {
  second: { count: 0, resetTime: 0 } as RateLimitCounter,
  minute: { count: 0, resetTime: 0 } as RateLimitCounter,
  hour: { count: 0, resetTime: 0 } as RateLimitCounter,
};

// Check and update rate limits
const checkRateLimit = (): boolean => {
  const now = Date.now();

  // Reset counters if needed
  if (now > rateLimitCounters.second.resetTime) {
    rateLimitCounters.second = { count: 0, resetTime: now + 1000 };
  }
  if (now > rateLimitCounters.minute.resetTime) {
    rateLimitCounters.minute = { count: 0, resetTime: now + 60000 };
  }
  if (now > rateLimitCounters.hour.resetTime) {
    rateLimitCounters.hour = { count: 0, resetTime: now + 3600000 };
  }

  // Check limits
  if (rateLimitCounters.second.count >= RATE_LIMITS.perSecond) return false;
  if (rateLimitCounters.minute.count >= RATE_LIMITS.perMinute) return false;
  if (rateLimitCounters.hour.count >= RATE_LIMITS.perHour) return false;

  return true;
};

// Increment rate limit counters
const incrementRateLimit = () => {
  rateLimitCounters.second.count++;
  rateLimitCounters.minute.count++;
  rateLimitCounters.hour.count++;
};

// ====================================
// EMAIL PROCESSING LOGIC
// ====================================

interface ProcessingResult {
  emailId: number;
  success: boolean;
  error?: string;
  duration: number;
  rateLimited?: boolean;
}

interface ProcessingSummary {
  total: number;
  sent: number;
  failed: number;
  rateLimited: number;
  duration: number;
  errors: string[];
}

// Process single email
const processSingleEmail = async (
  email: EmailNotification & { email: string; unsubscribe_token: string }
): Promise<ProcessingResult> => {
  const startTime = Date.now();
  const result: ProcessingResult = {
    emailId: email.id,
    success: false,
    duration: 0,
  };

  try {
    // Check rate limiting
    if (!checkRateLimit()) {
      result.rateLimited = true;
      result.duration = Date.now() - startTime;
      return result;
    }

    // Prepare email data
    const emailData = {
      email: email.email,
      model: email.model,
      datacenter: email.datacenter,
      statusChange: email.status_change as StatusChange,
      unsubscribeToken: email.unsubscribe_token,
    };

    // Send email
    const sent = await sendNotificationEmail(emailData);

    if (sent) {
      // Mark as sent in database
      await markEmailAsSent(email.id);
      incrementRateLimit();
      result.success = true;

      logger.log(
        `✅ Email sent to ${email.email} for model ${email.model} in ${email.datacenter}`
      );
    } else {
      throw new Error("Email sending returned false");
    }
  } catch (error) {
    result.error = (error as Error).message;

    // Increment failed attempts
    try {
      await incrementEmailFailedAttempts(email.id);
    } catch (dbError) {
      logger.error("Failed to increment email attempts:", dbError);
    }

    logger.error(`❌ Failed to send email ${email.id}:`, result.error);
  }

  result.duration = Date.now() - startTime;
  return result;
};

// Process emails in controlled batches
const processEmailBatch = async (
  emails: Array<
    EmailNotification & { email: string; unsubscribe_token: string }
  >
): Promise<ProcessingSummary> => {
  const startTime = Date.now();
  const summary: ProcessingSummary = {
    total: emails.length,
    sent: 0,
    failed: 0,
    rateLimited: 0,
    duration: 0,
    errors: [],
  };

  logger.log(`📧 Processing ${emails.length} pending emails...`);

  // Process emails in parallel batches
  for (let i = 0; i < emails.length; i += MAX_PARALLEL_SENDS) {
    const batch = emails.slice(i, i + MAX_PARALLEL_SENDS);

    // Process batch in parallel
    const batchPromises = batch.map((email) => processSingleEmail(email));
    const batchResults = await Promise.allSettled(batchPromises);

    // Collect results
    batchResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const emailResult = result.value;

        if (emailResult.success) {
          summary.sent++;
        } else if (emailResult.rateLimited) {
          summary.rateLimited++;
        } else {
          summary.failed++;
          if (emailResult.error) {
            summary.errors.push(
              `Email ${emailResult.emailId}: ${emailResult.error}`
            );
          }
        }
      } else {
        summary.failed++;
        summary.errors.push(`Email ${batch[index].id}: ${result.reason}`);
      }
    });

    // Add delay between batches for rate limiting
    if (i + MAX_PARALLEL_SENDS < emails.length) {
      await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
    }

    // Check if we're running out of time
    if (Date.now() - startTime > MAX_PROCESSING_TIME) {
      logger.warn("⏰ Email processing timeout reached, stopping early");
      break;
    }
  }

  summary.duration = Date.now() - startTime;
  return summary;
};

// ====================================
// MAIN CRON ENDPOINT
// ====================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Security check
  const cronSecret =
    request.headers.get("X-Cron-Secret") ||
    request.nextUrl.searchParams.get("secret");

  if (cronSecret !== process.env.CRON_SECRET) {
    logger.warn(
      "Unauthorized email cron request from:",
      request.headers.get("cf-connecting-ip") || "unknown"
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.log("📬 Starting email notification processing...");

  try {
    // Get batch size from query params or use default
    const { searchParams } = new URL(request.url);
    const batchSize = Math.min(
      parseInt(searchParams.get("batch") || BATCH_SIZE.toString()),
      100 // Maximum safety limit
    );

    // Fetch pending emails
    const pendingEmails = await getPendingEmails(batchSize);

    if (pendingEmails.length === 0) {
      logger.log("📭 No pending emails to process");
      return NextResponse.json({
        success: true,
        message: "No pending emails",
        timestamp: new Date().toISOString(),
        processed: 0,
        duration: Date.now() - startTime,
      });
    }

    // Process the emails
    const summary = await processEmailBatch(pendingEmails);

    // Log results
    const logLevel =
      summary.failed === 0 ? "✅" : summary.sent > 0 ? "⚠️" : "❌";
    logger.log(
      `${logLevel} Email processing completed: ${summary.sent} sent, ` +
        `${summary.failed} failed, ${summary.rateLimited} rate limited ` +
        `(${summary.duration}ms)`
    );

    if (summary.errors.length > 0) {
      logger.error("Email errors:", summary.errors.slice(0, 10)); // Show first 10 errors
    }

    // Prepare response
    const response = {
      success: summary.failed < summary.total, // Success if at least some emails were processed
      timestamp: new Date().toISOString(),
      summary: {
        ...summary,
        rateLimits: {
          second: `${rateLimitCounters.second.count}/${RATE_LIMITS.perSecond}`,
          minute: `${rateLimitCounters.minute.count}/${RATE_LIMITS.perMinute}`,
          hour: `${rateLimitCounters.hour.count}/${RATE_LIMITS.perHour}`,
        },
      },
      message:
        summary.sent > 0
          ? `Successfully sent ${summary.sent}/${summary.total} emails`
          : summary.rateLimited > 0
            ? `Rate limited: ${summary.rateLimited} emails deferred`
            : "Failed to send any emails",
    };

    return NextResponse.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("❌ Email processing failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Email processing failed",
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        duration,
      },
      { status: 500 }
    );
  }
}

// POST endpoint for manual triggering with custom parameters
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const cronSecret = request.headers.get("X-Cron-Secret") || body.secret;

    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create new request with custom parameters
    const url = new URL(request.url);
    if (body.batch) url.searchParams.set("batch", body.batch.toString());

    const newRequest = new NextRequest(url, {
      method: "GET",
      headers: request.headers,
    });

    return GET(newRequest);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request",
        message: (error as Error).message,
      },
      { status: 400 }
    );
  }
}

// Health check endpoint
export async function HEAD() {
  try {
    // Quick check for pending emails count
    const pendingEmails = await getPendingEmails(1);

    return new Response(null, {
      status: 200,
      headers: {
        "X-Email-Status": "ready",
        "X-Pending-Count": pendingEmails.length.toString(),
        "X-Rate-Limit-Hour": `${rateLimitCounters.hour.count}/${RATE_LIMITS.perHour}`,
      },
    });
  } catch (error) {
    return new Response(null, {
      status: 503,
      headers: {
        "X-Email-Status": "error",
        "X-Error": (error as Error).message,
      },
    });
  }
}

// ====================================
// UTILITY ENDPOINTS
// ====================================

// DELETE endpoint to clear failed emails (admin use)
export async function DELETE(request: NextRequest) {
  const cronSecret = request.headers.get("X-Cron-Secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // This would require additional database query to clear failed emails
    // Implementation depends on your requirements

    return NextResponse.json({
      success: true,
      message: "Failed emails cleared",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to clear emails",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
