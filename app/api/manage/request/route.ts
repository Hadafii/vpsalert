// app/api/manage/request/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/queries";
import { checkRateLimit } from "@/lib/db-rate-limiter";
import { getClientIP, sanitizeEmail } from "@/lib/security";
import { logger } from "@/lib/logs";

// Management link email template
const getManagementEmailHTML = (email: string, managementToken: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Manage Your VPS Subscriptions - OVH VPS Monitor</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0070f3; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .btn { display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
    .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 16px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🖥️ Manage Your VPS Subscriptions</h1>
  </div>
  <div class="content">
    <h2>Access Your Subscription Dashboard</h2>
    <p>Click the button below to manage your OVH VPS availability notifications:</p>
    
    <p style="text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/manage/${managementToken}" class="btn">
        ⚙️ Manage Subscriptions
      </a>
    </p>
    
    <div class="warning">
      <strong>🔐 Security Note:</strong> This link is personal to your email address. 
      Don't share it with others as it provides access to modify your notification preferences.
    </div>
    
    <p><strong>What you can do:</strong></p>
    <ul>
      <li>View all your active subscriptions</li>
      <li>Add new VPS models and datacenters to monitor</li>
      <li>Remove subscriptions you no longer need</li>
      <li>Update your notification preferences</li>
    </ul>
    
    <p>This link will remain valid for future use. Bookmark it for easy access!</p>
  </div>
  <div class="footer">
    <p>You received this email because you requested access to manage your VPS subscriptions.</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}">Visit Dashboard</a></p>
  </div>
</body>
</html>
`;

// Send management email using existing email system
const sendManagementEmail = async (
  email: string,
  managementToken: string
): Promise<boolean> => {
  try {
    // Use the existing SMTP transporter setup from email.ts
    const nodemailer = require("nodemailer");

    const config = {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      },
    };

    const transporter = nodemailer.createTransporter(config);

    await transporter.sendMail({
      from: {
        name: "OVH VPS Monitor",
        address: process.env.FROM_EMAIL || "noreply@ovh-monitor.com",
      },
      to: email,
      subject: "🔗 Access Your VPS Subscription Dashboard",
      html: getManagementEmailHTML(email, managementToken),
      text: `Access your VPS subscription dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/manage/${managementToken}`,
      headers: {
        "X-Priority": "3", // Normal priority
      },
    });

    logger.log(`Management email sent to ${email}`);
    return true;
  } catch (error) {
    logger.error("Failed to send management email:", error);
    return false;
  }
};

// POST /api/manage/request - Send management link to email
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);

  try {
    // Parse request body
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

    // Validate and sanitize email
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

    // Rate limiting - stricter for management requests
    const allowed = await checkRateLimit(`manage_${clientIP}`, 60, 3); // 3 requests per hour
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

    // Additional rate limiting per email
    const emailAllowed = await checkRateLimit(
      `manage_email_${cleanEmail}`,
      60,
      2
    ); // 2 per hour per email
    if (!emailAllowed) {
      logger.warn(
        `Management request rate limit exceeded for email ${cleanEmail}`
      );
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests for this email",
          message: "Please check your email or try again later.",
        },
        { status: 429 }
      );
    }

    logger.log(
      `Management link request from ${clientIP} for email: ${cleanEmail}`
    );

    // Get or create user (this will create user if doesn't exist)
    const user = await getOrCreateUser(cleanEmail);

    if (!user.unsubscribe_token) {
      throw new Error("User created without unsubscribe token");
    }

    // Send management email
    const emailSent = await sendManagementEmail(
      cleanEmail,
      user.unsubscribe_token
    );

    if (!emailSent) {
      throw new Error("Failed to send management email");
    }

    const duration = Date.now() - startTime;

    logger.log(`✅ Management link sent to ${cleanEmail} (${duration}ms)`);

    return NextResponse.json({
      success: true,
      message: "Management link sent to your email",
      data: {
        email: cleanEmail,
        sent_at: new Date().toISOString(),
        expires_note:
          "This link does not expire and can be bookmarked for future use",
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
        timestamp: new Date().toISOString(),
        duration,
      },
      { status: 500 }
    );
  }
}

// GET /api/manage/request - Info about the endpoint
export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/manage/request",
    description: "Send management link to email address",
    rateLimit: {
      perIP: "3 requests per hour",
      perEmail: "2 requests per hour",
    },
    requiredFields: ["email"],
    example: {
      email: "user@example.com",
    },
  });
}

// OPTIONS /api/manage/request - CORS support
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
