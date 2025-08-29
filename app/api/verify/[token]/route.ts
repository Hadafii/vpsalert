import { NextRequest, NextResponse } from "next/server";
import { verifyUser, getUserSubscriptions } from "@/lib/queries";
import { sanitizeToken, getClientIP } from "@/lib/security";
import { logger } from "@/lib/logs";

// GET /api/verify/[token] - Verify email and return JSON
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const clientIP = getClientIP(request);

  try {
    const { token } = await params;

    logger.log(
      `Verification request from ${clientIP} for token: ${token.substring(0, 8)}...`
    );

    // Sanitize and validate token
    const cleanToken = sanitizeToken(token);

    // Attempt to verify user
    const user = await verifyUser(cleanToken);

    if (!user) {
      logger.warn(
        `Verification failed for token from ${clientIP}: user not found or already verified`
      );

      return NextResponse.json(
        {
          success: false,
          error: "INVALID_TOKEN",
          message:
            "This verification link is invalid, has expired, or has already been used.",
          code: "TOKEN_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // Get user's subscriptions
    const subscriptions = await getUserSubscriptions(user.id);
    const activeSubscriptions = subscriptions.filter((sub) => sub.is_active);

    logger.log(
      `✅ Email verified successfully for ${user.email} (${activeSubscriptions.length} subscriptions)`
    );

    return NextResponse.json({
      success: true,
      message:
        "Email verified successfully! Your notifications are now active.",
      data: {
        user: {
          id: user.id,
          email: user.email,
          email_verified: true,
          created_at: user.created_at,
          verified_at: new Date().toISOString(),
        },
        subscriptions: {
          total: subscriptions.length,
          active: activeSubscriptions.length,
          models: [...new Set(activeSubscriptions.map((s) => s.model))],
          datacenters: [
            ...new Set(activeSubscriptions.map((s) => s.datacenter)),
          ],
        },
        next_steps: [
          "You'll receive instant notifications when VPS becomes available",
          "Monitor real-time status on our dashboard",
          "Manage your subscriptions anytime",
        ],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Email verification error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "VERIFICATION_ERROR",
        message: "An unexpected error occurred while verifying your email.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
