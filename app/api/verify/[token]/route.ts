// app/api/verify/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyUser, getUserSubscriptions } from "@/lib/queries";
import { getClientIP } from "@/lib/security";
import { logger } from "@/lib/logs";
// ====================================
// HELPER FUNCTIONS
// ====================================

const validateVerificationToken = (token: string): boolean => {
  // Basic token validation - should be 32-character hex string
  return /^[a-f0-9]{32}$/.test(token);
};

// ====================================
// SUCCESS PAGE HTML
// ====================================

const getSuccessPageHTML = (email: string, subscriptionCount: number) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verified - OVH VPS Monitor</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      padding: 40px;
      text-align: center;
      max-width: 500px;
      width: 100%;
    }
    .success-icon {
      font-size: 64px;
      margin-bottom: 20px;
      animation: bounce 1s ease-in-out;
    }
    @keyframes bounce {
      0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-10px); }
      60% { transform: translateY(-5px); }
    }
    h1 { color: #333; margin-bottom: 16px; font-size: 28px; }
    p { color: #666; line-height: 1.6; margin-bottom: 16px; }
    .email { 
      background: #f8f9fa; 
      padding: 12px 16px; 
      border-radius: 8px; 
      font-weight: 600; 
      color: #495057;
      margin: 20px 0;
    }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 24px 0;
    }
    .stat {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-number { font-size: 24px; font-weight: bold; color: #0070f3; }
    .stat-label { font-size: 12px; color: #666; margin-top: 4px; }
    .btn {
      display: inline-block;
      background: #0070f3;
      color: white;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-weight: 600;
      margin: 8px;
      transition: all 0.2s;
    }
    .btn:hover { background: #0056b3; transform: translateY(-1px); }
    .btn-secondary {
      background: #6c757d;
    }
    .btn-secondary:hover { background: #545b62; }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #dee2e6;
      font-size: 14px;
      color: #6c757d;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✅</div>
    <h1>Email Verified Successfully!</h1>
    <p>Your email address has been verified and your subscriptions are now active.</p>
    
    <div class="email">${email}</div>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-number">${subscriptionCount}</div>
        <div class="stat-label">Active Subscriptions</div>
      </div>
      <div class="stat">
        <div class="stat-number">15s</div>
        <div class="stat-label">Check Interval</div>
      </div>
    </div>
    
    <p>
      <strong>What happens next?</strong><br>
      You'll receive instant email notifications when your selected VPS models become available.
      We check OVH's API every 15 seconds for the latest availability.
    </p>
    
    <div style="margin-top: 24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}" class="btn">
        🏠 Go to Dashboard
      </a>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/subscribe" class="btn btn-secondary">
        ⚙️ Manage Subscriptions
      </a>
    </div>
    
    <div class="footer">
      <p>You can unsubscribe or modify your preferences at any time.</p>
    </div>
  </div>
</body>
</html>
`;

const getErrorPageHTML = (error: string, description: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Error - OVH VPS Monitor</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background: linear-gradient(135deg, #ff7b7b 0%, #d63031 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      padding: 40px;
      text-align: center;
      max-width: 500px;
      width: 100%;
    }
    .error-icon { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #333; margin-bottom: 16px; font-size: 28px; }
    p { color: #666; line-height: 1.6; margin-bottom: 16px; }
    .error-details {
      background: #fff5f5;
      border: 1px solid #fed7d7;
      color: #c53030;
      padding: 16px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .btn {
      display: inline-block;
      background: #0070f3;
      color: white;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-weight: 600;
      margin: 8px;
      transition: all 0.2s;
    }
    .btn:hover { background: #0056b3; }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">❌</div>
    <h1>Verification Failed</h1>
    <p>We couldn't verify your email address.</p>
    
    <div class="error-details">
      <strong>${error}</strong><br>
      ${description}
    </div>
    
    <p>This usually happens when:</p>
    <ul style="text-align: left; margin: 16px 0;">
      <li>The verification link has expired</li>
      <li>The link has already been used</li>
      <li>The token is invalid or corrupted</li>
    </ul>
    
    <div style="margin-top: 24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/subscribe" class="btn">
        📝 Subscribe Again
      </a>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}" class="btn" style="background: #6c757d;">
        🏠 Go Home
      </a>
    </div>
  </div>
</body>
</html>
`;

// ====================================
// API ENDPOINTS
// ====================================

// GET /api/verify/[token] - Verify email address
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const clientIP = getClientIP(request);

  try {
    const { token } = await params;

    logger.log(
      `Email verification request from ${clientIP} with token: ${token.substring(0, 8)}...`
    );

    // Validate token format
    if (!validateVerificationToken(token)) {
      logger.warn(`Invalid verification token format from ${clientIP}`);

      return new NextResponse(
        getErrorPageHTML(
          "Invalid Token Format",
          "The verification token must be a 32-character hexadecimal string."
        ),
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    // Attempt to verify user
    const user = await verifyUser(token);

    if (!user) {
      logger.warn(
        `Verification failed for token from ${clientIP}: user not found or already verified`
      );

      return new NextResponse(
        getErrorPageHTML(
          "Invalid or Expired Token",
          "This verification link is invalid, has expired, or has already been used. Please request a new verification email."
        ),
        {
          status: 404,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    // Get user's subscriptions for display
    const subscriptions = await getUserSubscriptions(user.id);
    const activeSubscriptions = subscriptions.filter((sub) => sub.is_active);

    logger.log(
      `✅ Email verified successfully for ${user.email} (${activeSubscriptions.length} subscriptions)`
    );

    // Return success page
    return new NextResponse(
      getSuccessPageHTML(user.email, activeSubscriptions.length),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "no-cache",
        },
      }
    );
  } catch (error) {
    logger.error("Email verification error:", error);

    return new NextResponse(
      getErrorPageHTML(
        "Verification Error",
        "An unexpected error occurred while verifying your email. Please try again or contact support."
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
}

// POST /api/verify/[token] - Alternative verification method (for form submissions)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // For JSON API responses instead of HTML
  const clientIP = getClientIP(request);

  try {
    const { token } = await params;

    if (!validateVerificationToken(token)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid token format",
          message:
            "The verification token must be a 32-character hexadecimal string.",
        },
        { status: 400 }
      );
    }

    const user = await verifyUser(token);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired token",
          message:
            "This verification link is invalid, has expired, or has already been used.",
        },
        { status: 404 }
      );
    }

    const subscriptions = await getUserSubscriptions(user.id);
    const activeSubscriptions = subscriptions.filter((sub) => sub.is_active);

    logger.log(`✅ Email verified via POST for ${user.email}`);

    return NextResponse.json({
      success: true,
      message: "Email verified successfully",
      data: {
        user: {
          id: user.id,
          email: user.email,
          email_verified: true,
          verified_at: new Date().toISOString(),
        },
        subscriptions: {
          total: subscriptions.length,
          active: activeSubscriptions.length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Email verification error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Verification failed",
        message: "An unexpected error occurred while verifying your email.",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// HEAD /api/verify/[token] - Check token validity without verifying
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!validateVerificationToken(token)) {
      return new Response(null, { status: 400 });
    }

    // Just check if token exists in database without verifying
    // This would require a separate query function, but for now we'll use a simple approach
    return new Response(null, {
      status: 200,
      headers: {
        "X-Token-Valid": "unknown", // Would need separate check function
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return new Response(null, { status: 500 });
  }
}

// OPTIONS /api/verify/[token] - CORS support
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
