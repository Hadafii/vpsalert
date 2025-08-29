// app/api/unsubscribe/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getUserByUnsubscribeToken,
  getUserSubscriptions,
  unsubscribeUser,
} from "@/lib/queries";
import { getClientIP } from "@/lib/security";
import { logger } from "@/lib/logs";
// ====================================
// HELPER FUNCTIONS
// ====================================

const validateUnsubscribeToken = (token: string): boolean => {
  // Basic token validation - should be 32-character hex string
  return /^[a-f0-9]{32}$/.test(token);
};

// ====================================
// HTML PAGES
// ====================================

const getUnsubscribePageHTML = (user: any, activeSubscriptions: number) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe - OVH VPS Monitor</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
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
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #333; margin-bottom: 16px; font-size: 28px; }
    p { color: #666; line-height: 1.6; margin-bottom: 16px; }
    .user-info {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #fd7e14;
    }
    .subscription-count {
      font-size: 24px;
      font-weight: bold;
      color: #fd7e14;
      margin: 8px 0;
    }
    .warning {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
      padding: 16px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: left;
    }
    .btn {
      display: inline-block;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-weight: 600;
      margin: 8px;
      transition: all 0.2s;
      border: none;
      cursor: pointer;
      font-size: 16px;
    }
    .btn-danger {
      background: #dc3545;
      color: white;
    }
    .btn-danger:hover {
      background: #c82333;
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: #6c757d;
      color: white;
    }
    .btn-secondary:hover {
      background: #545b62;
      transform: translateY(-1px);
    }
    .btn-primary {
      background: #0070f3;
      color: white;
    }
    .btn-primary:hover {
      background: #0056b3;
      transform: translateY(-1px);
    }
    .actions {
      margin-top: 24px;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }
    @media (max-width: 480px) {
      .actions { flex-direction: column; }
      .btn { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⚠️</div>
    <h1>Unsubscribe Confirmation</h1>
    <p>You are about to unsubscribe from all OVH VPS availability notifications.</p>
    
    <div class="user-info">
      <div><strong>Email:</strong> ${user.email}</div>
      <div class="subscription-count">${activeSubscriptions} Active Subscriptions</div>
      <div><small>Member since: ${new Date(user.created_at).toLocaleDateString()}</small></div>
    </div>
    
    ${
      activeSubscriptions > 0
        ? `
      <div class="warning">
        <strong>⚠️ Warning:</strong> This action will:
        <ul style="margin-top: 8px;">
          <li>Stop all email notifications for VPS availability</li>
          <li>Deactivate all your ${activeSubscriptions} subscription(s)</li>
          <li>Remove you from our notification system</li>
        </ul>
        <p style="margin-top: 12px;"><strong>This action cannot be undone easily.</strong> You would need to subscribe again to receive notifications.</p>
      </div>
    `
        : `
      <div style="background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <strong>ℹ️ Note:</strong> You don't have any active subscriptions to remove.
      </div>
    `
    }
    
    <div class="actions">
      <form method="POST" style="display: inline;">
        <button type="submit" class="btn btn-danger">
          🗑️ Yes, Unsubscribe Me
        </button>
      </form>
      
      <a href="${process.env.NEXT_PUBLIC_APP_URL}" class="btn btn-secondary">
        ↩️ Cancel
      </a>
      
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/subscribe" class="btn btn-primary">
        ⚙️ Manage Subscriptions
      </a>
    </div>
    
    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #dee2e6; font-size: 14px; color: #6c757d;">
      <p>Need help? Contact us or visit our <a href="${process.env.NEXT_PUBLIC_APP_URL}">dashboard</a> to manage your preferences.</p>
    </div>
  </div>
</body>
</html>
`;

const getSuccessPageHTML = (email: string, removedCount: number) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed Successfully - OVH VPS Monitor</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background: linear-gradient(135deg, #a8e6cf 0%, #88d8a3 100%);
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
    .success-info {
      background: #d4edda;
      border: 1px solid #c3e6cb;
      color: #155724;
      padding: 20px;
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
    .btn:hover {
      background: #0056b3;
      transform: translateY(-1px);
    }
    .feedback {
      margin-top: 32px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✅</div>
    <h1>Successfully Unsubscribed</h1>
    <p>You have been removed from all OVH VPS availability notifications.</p>
    
    <div class="success-info">
      <div><strong>Email:</strong> ${email}</div>
      <div><strong>Subscriptions Removed:</strong> ${removedCount}</div>
      <div><strong>Unsubscribed At:</strong> ${new Date().toLocaleString()}</div>
    </div>
    
    <p>
      <strong>What this means:</strong><br>
      You will no longer receive email notifications when OVH VPS instances become available.
      Your email address remains in our system for administrative purposes only.
    </p>
    
    <div style="margin-top: 24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}" class="btn">
        🏠 Return to Homepage
      </a>
    </div>
    
    <div class="feedback">
      <h3 style="margin-bottom: 12px;">We're Sorry to See You Go</h3>
      <p>If you unsubscribed because of too many emails, you can always subscribe again and select fewer VPS models to monitor.</p>
      <div style="margin-top: 16px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/subscribe" class="btn" style="background: #28a745;">
          📧 Subscribe Again
        </a>
      </div>
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
  <title>Unsubscribe Error - OVH VPS Monitor</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
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
    <h1>Unsubscribe Error</h1>
    <p>We couldn't process your unsubscribe request.</p>
    
    <div class="error-details">
      <strong>${error}</strong><br>
      ${description}
    </div>
    
    <div style="margin-top: 24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}" class="btn">
        🏠 Go Home
      </a>
      <a href="mailto:support@ovh-monitor.com" class="btn" style="background: #28a745;">
        📧 Contact Support
      </a>
    </div>
  </div>
</body>
</html>
`;

// ====================================
// API ENDPOINTS
// ====================================

// GET /api/unsubscribe/[token] - Show unsubscribe confirmation page
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const clientIP = getClientIP(request);

  try {
    const { token } = await params;

    logger.log(
      `Unsubscribe page request from ${clientIP} with token: ${token.substring(0, 8)}...`
    );

    // Validate token format
    if (!validateUnsubscribeToken(token)) {
      logger.warn(`Invalid unsubscribe token format from ${clientIP}`);

      return new NextResponse(
        getErrorPageHTML(
          "Invalid Token Format",
          "The unsubscribe token must be a 32-character hexadecimal string."
        ),
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    // Find user by unsubscribe token
    const user = await getUserByUnsubscribeToken(token);

    if (!user) {
      logger.warn(
        `Unsubscribe failed for token from ${clientIP}: user not found`
      );

      return new NextResponse(
        getErrorPageHTML(
          "Invalid Token",
          "No user found with this unsubscribe token. The link may have expired or been corrupted."
        ),
        {
          status: 404,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    // Get user's subscriptions
    const subscriptions = await getUserSubscriptions(user.id);
    const activeSubscriptions = subscriptions.filter((sub) => sub.is_active);

    logger.log(
      `Showing unsubscribe page for ${user.email} (${activeSubscriptions.length} active subscriptions)`
    );

    // Return confirmation page
    return new NextResponse(
      getUnsubscribePageHTML(user, activeSubscriptions.length),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "no-cache",
        },
      }
    );
  } catch (error) {
    logger.error("Unsubscribe page error:", error);

    return new NextResponse(
      getErrorPageHTML(
        "Server Error",
        "An unexpected error occurred. Please try again or contact support."
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
}

// POST /api/unsubscribe/[token] - Process unsubscribe request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const clientIP = getClientIP(request);

  try {
    const { token } = await params;

    logger.log(
      `Unsubscribe action from ${clientIP} with token: ${token.substring(0, 8)}...`
    );

    // Validate token format
    if (!validateUnsubscribeToken(token)) {
      // Check if this is a JSON request or form submission
      const acceptHeader = request.headers.get("accept") || "";
      const isJsonRequest = acceptHeader.includes("application/json");

      if (isJsonRequest) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid token format",
            message:
              "The unsubscribe token must be a 32-character hexadecimal string.",
          },
          { status: 400 }
        );
      }

      return new NextResponse(
        getErrorPageHTML(
          "Invalid Token Format",
          "The unsubscribe token must be a 32-character hexadecimal string."
        ),
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    // Find user by unsubscribe token
    const user = await getUserByUnsubscribeToken(token);

    if (!user) {
      const acceptHeader = request.headers.get("accept") || "";
      const isJsonRequest = acceptHeader.includes("application/json");

      if (isJsonRequest) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid token",
            message: "No user found with this unsubscribe token.",
          },
          { status: 404 }
        );
      }

      return new NextResponse(
        getErrorPageHTML(
          "Invalid Token",
          "No user found with this unsubscribe token."
        ),
        {
          status: 404,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    // Get current subscriptions before unsubscribing
    const subscriptions = await getUserSubscriptions(user.id);
    const activeSubscriptions = subscriptions.filter((sub) => sub.is_active);
    const activeCount = activeSubscriptions.length;

    // Unsubscribe user
    const success = await unsubscribeUser(user.id);

    if (!success) {
      throw new Error("Failed to unsubscribe user from database");
    }

    logger.log(
      `✅ User ${user.email} successfully unsubscribed (${activeCount} subscriptions removed)`
    );

    // Check if this is a JSON request
    const acceptHeader = request.headers.get("accept") || "";
    const isJsonRequest = acceptHeader.includes("application/json");

    if (isJsonRequest) {
      return NextResponse.json({
        success: true,
        message: "Successfully unsubscribed from all notifications",
        data: {
          email: user.email,
          subscriptions_removed: activeCount,
          unsubscribed_at: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Return success page
    return new NextResponse(getSuccessPageHTML(user.email, activeCount), {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    logger.error("Unsubscribe processing error:", error);

    const acceptHeader = request.headers.get("accept") || "";
    const isJsonRequest = acceptHeader.includes("application/json");

    if (isJsonRequest) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsubscribe failed",
          message:
            "An unexpected error occurred while processing your request.",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    return new NextResponse(
      getErrorPageHTML(
        "Unsubscribe Failed",
        "An unexpected error occurred while processing your request. Please try again or contact support."
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
}

// OPTIONS /api/unsubscribe/[token] - CORS support
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Max-Age": "86400",
    },
  });
}
