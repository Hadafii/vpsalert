// app/api/subscriptions/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateUser,
  upsertSubscription,
  getUserSubscriptions,
  getVPSModels,
} from "@/lib/queries";
import { sendVerificationEmail, isValidEmail } from "@/lib/email";
import { checkRateLimit, getRateLimitStatus } from "@/lib/db-rate-limiter";
import { z } from "zod";
import { logger } from "@/lib/logs";
// ====================================
// VALIDATION SCHEMAS
// ====================================

const CreateSubscriptionSchema = z.object({
  email: z.string().email("Invalid email format").max(320, "Email too long"),
  model: z.number().int().min(1).max(6),
  datacenter: z.string().min(2).max(5).toUpperCase(),
  // Optional: allow multiple subscriptions in one request
  subscriptions: z
    .array(
      z.object({
        model: z.number().int().min(1).max(6),
        datacenter: z.string().min(2).max(5).toUpperCase(),
      })
    )
    .optional(),
});

const validDatacenters = ["GRA", "SBG", "BHS", "WAW", "UK", "DE", "FR"];

// ====================================
// HELPER FUNCTIONS
// ====================================

const getClientIP = (request: NextRequest): string => {
  // Try various headers for IP detection
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
};

const validateSubscriptionData = (data: any) => {
  // Validate main subscription
  if (data.model && data.datacenter) {
    if (!getVPSModels().includes(data.model)) {
      throw new Error(`Invalid VPS model: ${data.model}`);
    }

    if (!validDatacenters.includes(data.datacenter.toUpperCase())) {
      throw new Error(`Invalid datacenter: ${data.datacenter}`);
    }
  }

  // Validate additional subscriptions
  if (data.subscriptions && Array.isArray(data.subscriptions)) {
    for (const sub of data.subscriptions) {
      if (!getVPSModels().includes(sub.model)) {
        throw new Error(`Invalid VPS model in subscriptions: ${sub.model}`);
      }

      if (!validDatacenters.includes(sub.datacenter.toUpperCase())) {
        throw new Error(
          `Invalid datacenter in subscriptions: ${sub.datacenter}`
        );
      }
    }

    // Limit number of subscriptions per request
    if (data.subscriptions.length > 20) {
      throw new Error("Too many subscriptions in single request (max 20)");
    }
  }
};

// ====================================
// API ENDPOINTS
// ====================================

// POST /api/subscriptions - Create new subscription(s)
export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);

    // Use database-backed rate limiting
    const allowed = await checkRateLimit(clientIP, 5, 10); // 10 requests per 5 minutes
    if (!allowed) {
      logger.warn(`Rate limit exceeded for IP: ${clientIP}`);

      // Get rate limit status for better error response
      const rateStatus = await getRateLimitStatus(clientIP, 5);

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many subscription requests. Please try again later.",
          retryAfter: Math.ceil(
            (rateStatus.resetTime.getTime() - Date.now()) / 1000
          ),
          rateLimit: {
            current: rateStatus.current,
            limit: rateStatus.limit,
            resetTime: rateStatus.resetTime.toISOString(),
          },
        },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = CreateSubscriptionSchema.parse(body);

    // Additional custom validation
    validateSubscriptionData(validatedData);

    logger.log(
      `New subscription request from ${clientIP} for ${validatedData.email}`
    );

    // Get or create user
    const user = await getOrCreateUser(validatedData.email);

    // Prepare subscriptions to create
    const subscriptionsToCreate = [];

    // Add main subscription if provided
    if (validatedData.model && validatedData.datacenter) {
      subscriptionsToCreate.push({
        model: validatedData.model,
        datacenter: validatedData.datacenter.toUpperCase(),
      });
    }

    // Add additional subscriptions
    if (validatedData.subscriptions && validatedData.subscriptions.length > 0) {
      subscriptionsToCreate.push(
        ...validatedData.subscriptions.map((sub) => ({
          model: sub.model,
          datacenter: sub.datacenter.toUpperCase(),
        }))
      );
    }

    // Remove duplicates
    const uniqueSubscriptions = subscriptionsToCreate.filter(
      (sub, index, arr) =>
        arr.findIndex(
          (s) => s.model === sub.model && s.datacenter === sub.datacenter
        ) === index
    );

    if (uniqueSubscriptions.length === 0) {
      return NextResponse.json(
        {
          error: "No valid subscriptions provided",
          message:
            "Please provide at least one valid model and datacenter combination",
        },
        { status: 400 }
      );
    }

    // Create subscriptions
    const createdSubscriptions = [];
    for (const subscription of uniqueSubscriptions) {
      try {
        const created = await upsertSubscription(
          user.id,
          subscription.model,
          subscription.datacenter
        );
        createdSubscriptions.push(created);
      } catch (error) {
        logger.error(
          `Failed to create subscription for ${subscription.model}-${subscription.datacenter}:`,
          error
        );
        // Continue with other subscriptions
      }
    }

    // Send verification email if user is not verified
    let emailSent = false;
    if (!user.email_verified && user.verification_token) {
      try {
        emailSent = await sendVerificationEmail({
          email: user.email,
          verificationToken: user.verification_token,
        });

        if (emailSent) {
          logger.log(`✅ Verification email sent to ${user.email}`);
        } else {
          logger.error(`❌ Failed to send verification email to ${user.email}`);
        }
      } catch (error) {
        logger.error("Verification email error:", error);
      }
    }

    // Prepare response
    const responseData = {
      success: true,
      message:
        createdSubscriptions.length > 0
          ? `Successfully created ${createdSubscriptions.length} subscription(s)`
          : "Subscriptions already exist",
      data: {
        user: {
          id: user.id,
          email: user.email,
          email_verified: user.email_verified,
          unsubscribe_token: user.unsubscribe_token,
        },
        subscriptions: createdSubscriptions.length,
        created: createdSubscriptions,
        verification_email_sent: emailSent,
        next_steps: user.email_verified
          ? "You will receive notifications when your selected VPS models become available."
          : "Please check your email and verify your address to receive notifications.",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    logger.error("Subscription creation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation error",
          message: "Invalid request data",
          details: error.issues.map((e: any) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    if ((error as Error).message.includes("Invalid")) {
      return NextResponse.json(
        {
          error: "Invalid data",
          message: (error as Error).message,
          validModels: getVPSModels(),
          validDatacenters,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to create subscription. Please try again later.",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// GET /api/subscriptions - Get subscription info (requires token or email)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const token = searchParams.get("token");

    if (!email && !token) {
      return NextResponse.json(
        {
          error: "Missing parameter",
          message: "Email or unsubscribe token is required",
        },
        { status: 400 }
      );
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        {
          error: "Invalid email",
          message: "Please provide a valid email address",
        },
        { status: 400 }
      );
    }

    // For now, we'll implement a simple lookup by email
    // In production, you might want to require token-based access for security
    if (email) {
      const user = await getOrCreateUser(email);
      const subscriptions = await getUserSubscriptions(user.id);

      return NextResponse.json({
        success: true,
        data: {
          user: {
            email: user.email,
            email_verified: user.email_verified,
            created_at: user.created_at,
          },
          subscriptions: subscriptions.map((sub) => ({
            id: sub.id,
            model: sub.model,
            datacenter: sub.datacenter,
            is_active: sub.is_active,
            created_at: sub.created_at,
          })),
          total: subscriptions.length,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // TODO: Implement token-based lookup for more secure access
    return NextResponse.json(
      {
        error: "Not implemented",
        message: "Token-based lookup not yet implemented",
      },
      { status: 501 }
    );
  } catch (error) {
    logger.error("Subscription lookup error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to retrieve subscriptions",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// OPTIONS /api/subscriptions - CORS support
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
