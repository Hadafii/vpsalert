import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/queries";
import { checkRateLimit } from "@/lib/db-rate-limiter";
import { getClientIP, sanitizeEmail } from "@/lib/security";
import { logger } from "@/lib/logs";
import { sendManagementEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: "Email required",
          message: "Please provide your email address",
        },
        { status: 400 }
      );
    }

    let cleanEmail: string;
    try {
      cleanEmail = sanitizeEmail(email);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email",
          message: "Please provide a valid email address",
        },
        { status: 400 }
      );
    }

    const allowed = await checkRateLimit(`manage_${clientIP}`, 60, 5);
    if (!allowed) {
      logger.warn(`Management request rate limit exceeded for ${clientIP}`);
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again in 1 hour.",
          retryAfter: 3600,
        },
        { status: 429 }
      );
    }

    const emailAllowed = await checkRateLimit(
      `manage_email_${cleanEmail}`,
      30,
      3
    );
    if (!emailAllowed) {
      logger.warn(
        `Management request rate limit exceeded for email ${cleanEmail}`
      );
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests for this email",
          message: "Please check your email or try again in 30 minutes.",
        },
        { status: 429 }
      );
    }

    logger.log(
      `Management link request from ${clientIP} for email: ${cleanEmail}`
    );

    const user = await getOrCreateUser(cleanEmail);

    if (!user.unsubscribe_token) {
      throw new Error("User created without unsubscribe token");
    }

    const emailSent = await sendManagementEmail(
      cleanEmail,
      user.unsubscribe_token
    );

    if (!emailSent) {
      logger.warn(
        `Management email failed for ${cleanEmail}, but continuing...`
      );

      return NextResponse.json(
        {
          success: false,
          error: "Email delivery failed",
          message:
            "Unable to send email right now. Please try again in a few minutes.",
          data: {
            email: cleanEmail,
            canRetry: true,
            retryAfter: 300,
          },
        },
        { status: 503 }
      );
    }

    const duration = Date.now() - startTime;

    logger.log(`✅ Management link sent to ${cleanEmail} (${duration}ms)`);

    return NextResponse.json({
      success: true,
      message:
        "Management link sent to your email! Check your inbox and spam folder.",
      data: {
        email: cleanEmail,
        sent_at: new Date().toISOString(),
        expires_note:
          "This link does not expire and can be bookmarked for future use",
        check_spam: true,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Management request failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Request failed",
        message: "Unable to send management link. Please try again later.",
        data: {
          canRetry: true,
          retryAfter: 300,
        },
        timestamp: new Date().toISOString(),
        duration,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/manage/request",
    description: "Send management link to email address",
    rateLimit: {
      perIP: "5 requests per hour",
      perEmail: "3 requests per 30 minutes",
    },
    requiredFields: ["email"],
    example: {
      email: "user@example.com",
    },
    features: [
      "Automatic user creation if email doesn't exist",
      "Permanent management link (doesn't expire)",
      "Professional email template",
      "Rate limiting for security",
    ],
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
