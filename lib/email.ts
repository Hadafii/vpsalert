// lib/email.ts
import nodemailer from "nodemailer";
import { StatusChange } from "./queries";
import { logger } from "@/lib/logs";
// ====================================
// CONFIGURATION & TYPES
// ====================================

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface NotificationEmailData {
  email: string;
  model: number;
  datacenter: string;
  statusChange: StatusChange;
  unsubscribeToken: string;
}

interface VerificationEmailData {
  email: string;
  verificationToken: string;
}

// ====================================
// SMTP TRANSPORTER
// ====================================

let transporter: nodemailer.Transporter | null = null;

const createTransporter = (): nodemailer.Transporter => {
  if (transporter) return transporter;

  const config: EmailConfig = {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  };

  transporter = nodemailer.createTransport(config);

  // Verify connection
  transporter.verify((error) => {
    if (error) {
      logger.error("SMTP configuration error:", error);
    } else {
      logger.log("SMTP server ready");
    }
  });

  return transporter;
};

// ====================================
// VPS MODEL DATA
// ====================================

const VPS_MODELS: Record<
  number,
  { name: string; specs: string; price: string }
> = {
  1: { name: "VPS-1", specs: "4 vCores, 8GB RAM, 75GB SSD", price: "US$4.20" },
  2: {
    name: "VPS-2",
    specs: "6 vCores, 12GB RAM, 100GB SSD",
    price: "US$6.75",
  },
  3: {
    name: "VPS-3",
    specs: "8 vCores, 24GB RAM, 200GB SSD",
    price: "US$12.75",
  },
  4: {
    name: "VPS-4",
    specs: "12 vCores, 48GB RAM, 300GB SSD",
    price: "US$25.08",
  },
  5: {
    name: "VPS-5",
    specs: "16 vCores, 64GB RAM, 350GB SSD",
    price: "US$34.34",
  },
  6: {
    name: "VPS-6",
    specs: "24 vCores, 96GB RAM, 400GB SSD",
    price: "US$45.39",
  },
};

const DATACENTER_NAMES: Record<string, string> = {
  GRA: "Gravelines, France",
  SBG: "Strasbourg, France",
  BHS: "Beauharnois, Canada",
  WAW: "Warsaw, Poland",
  UK: "London, UK",
  DE: "Frankfurt, Germany",
  FR: "Roubaix, France",
};

// ====================================
// EMAIL TEMPLATES
// ====================================

const getBaseTemplate = (content: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OVH VPS Monitor</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0070f3; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .vps-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0070f3; }
    .status-available { color: #28a745; font-weight: bold; }
    .status-unavailable { color: #dc3545; font-weight: bold; }
    .btn { display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🖥️ OVH VPS Monitor</h1>
  </div>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    <p>You received this email because you subscribed to OVH VPS availability notifications.</p>
    <p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}">Visit Dashboard</a> | 
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/manage/{{unsubscribe_token}}">Manage Subscriptions</a> | 
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe/{{unsubscribe_token}}">Unsubscribe</a>
    </p>
  </div>
</body>
</html>
`;

const getVerificationTemplate = (
  data: VerificationEmailData
): EmailTemplate => {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify/${data.verificationToken}`;

  const html = getBaseTemplate(`
    <h2>Welcome to OVH VPS Monitor! 🎉</h2>
    <p>Thank you for subscribing to OVH VPS availability notifications.</p>
    <p>To activate your subscription, please verify your email address by clicking the button below:</p>
    <p style="text-align: center;">
      <a href="${verificationUrl}" class="btn">Verify Email Address</a>
    </p>
    <p>Or copy and paste this link in your browser:</p>
    <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 4px;">
      ${verificationUrl}
    </p>
    <p><strong>What's next?</strong></p>
    <ul>
      <li>Once verified, you'll receive instant notifications when your selected VPS models become available</li>
      <li>You can manage your subscriptions anytime from our dashboard or via direct management link in emails</li>
      <li>We check availability every 30 seconds for real-time updates</li>
    </ul>
  `);

  return {
    subject: "✅ Verify your OVH VPS Monitor subscription",
    html: html.replace("{{unsubscribe_token}}", ""),
    text: `Welcome to OVH VPS Monitor!\n\nPlease verify your email address: ${verificationUrl}\n\nOnce verified, you'll receive notifications when your selected VPS models become available.\n\nYou can manage your subscriptions anytime from our dashboard or via direct management links in emails.`,
  };
};

const getNotificationTemplate = (
  data: NotificationEmailData
): EmailTemplate => {
  const vpsModel = VPS_MODELS[data.model];
  const datacenterName = DATACENTER_NAMES[data.datacenter] || data.datacenter;
  const isAvailable = data.statusChange === "became_available";

  const statusText = isAvailable ? "AVAILABLE" : "OUT OF STOCK";
  const statusClass = isAvailable ? "status-available" : "status-unavailable";
  const emoji = isAvailable ? "✅" : "❌";

  const ovhUrl = `https://www.ovhcloud.com/en/vps/`;

  const html = getBaseTemplate(`
    <h2>${emoji} VPS Status Update</h2>
    <div class="vps-info">
      <h3>${vpsModel.name}</h3>
      <p><strong>Specs:</strong> ${vpsModel.specs}</p>
      <p><strong>Datacenter:</strong> ${datacenterName}</p>
      <p><strong>Status:</strong> <span class="${statusClass}">${statusText}</span></p>
    </div>
    
    ${
      isAvailable
        ? `
      <p>🎉 <strong>Great news!</strong> This VPS model is now available for purchase.</p>
      <p style="text-align: center;">
        <a href="${ovhUrl}" class="btn">Order Now at OVH</a>
      </p>
      <p><small><em>Note: Availability can change quickly. We recommend ordering as soon as possible.</em></small></p>
    `
        : `
      <p>This VPS model is currently out of stock. We'll notify you as soon as it becomes available again.</p>
    `
    }
    
    <hr style="margin: 30px 0;">
    <p><strong>Want to modify your notifications?</strong></p>
    <p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}">Visit our dashboard</a> to add or remove VPS models from your watchlist, or 
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/manage/{{unsubscribe_token}}">manage your subscriptions</a> directly.
    </p>
  `);

  return {
    subject: `${emoji} ${vpsModel.name} is ${statusText} in ${datacenterName}`,
    html: html.replace("{{unsubscribe_token}}", data.unsubscribeToken),
    text: `OVH VPS Status Update\n\n${vpsModel.name} (${vpsModel.specs}) in ${datacenterName} is ${statusText}.\n\n${isAvailable ? `Order now: ${ovhUrl}` : "We'll notify you when it becomes available."}\n\nDashboard: ${process.env.NEXT_PUBLIC_APP_URL}\nManage Subscriptions: ${process.env.NEXT_PUBLIC_APP_URL}/manage/${data.unsubscribeToken}\nUnsubscribe: ${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe/${data.unsubscribeToken}`,
  };
};

// ====================================
// EMAIL SENDING FUNCTIONS
// ====================================

export const sendVerificationEmail = async (
  data: VerificationEmailData
): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    const template = getVerificationTemplate(data);

    await transporter.sendMail({
      from: {
        name: "OVH VPS Monitor",
        address: process.env.FROM_EMAIL || "noreply@ovh-monitor.com",
      },
      to: data.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    logger.log(`Verification email sent to ${data.email}`);
    return true;
  } catch (error) {
    logger.error("Failed to send verification email:", error);
    return false;
  }
};

export const sendNotificationEmail = async (
  data: NotificationEmailData
): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    const template = getNotificationTemplate(data);

    await transporter.sendMail({
      from: {
        name: "OVH VPS Monitor",
        address: process.env.FROM_EMAIL || "noreply@ovh-monitor.com",
      },
      to: data.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      headers: {
        "X-Priority": "1", // High priority for availability notifications
        "X-MSMail-Priority": "High",
      },
    });

    logger.log(
      `Notification email sent to ${data.email} for ${VPS_MODELS[data.model].name}`
    );
    return true;
  } catch (error) {
    logger.error("Failed to send notification email:", error);
    return false;
  }
};

// Batch send emails with rate limiting
export const sendEmailBatch = async (
  emails: NotificationEmailData[],
  batchSize: number = 10,
  delayMs: number = 1000
): Promise<{ sent: number; failed: number }> => {
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map((email) => sendNotificationEmail(email))
    );

    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        sent++;
      } else {
        failed++;
      }
    });

    // Add delay between batches to prevent rate limiting
    if (i + batchSize < emails.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { sent, failed };
};

// ====================================
// EMAIL VALIDATION
// ====================================

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 320;
};

// ====================================
// TESTING & HEALTH CHECK
// ====================================

export const testEmailConnection = async (): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    logger.error("Email connection test failed:", error);
    return false;
  }
};

export const sendTestEmail = async (to: string): Promise<boolean> => {
  try {
    const transporter = createTransporter();

    await transporter.sendMail({
      from: {
        name: "OVH VPS Monitor",
        address: process.env.FROM_EMAIL || "noreply@ovh-monitor.com",
      },
      to,
      subject: "🧪 Test Email - OVH VPS Monitor",
      html: getBaseTemplate(`
        <h2>🧪 Test Email</h2>
        <p>This is a test email to verify your SMTP configuration is working correctly.</p>
        <p><strong>Configuration:</strong></p>
        <ul>
          <li>SMTP Host: ${process.env.SMTP_HOST}</li>
          <li>SMTP Port: ${process.env.SMTP_PORT}</li>
          <li>From Email: ${process.env.FROM_EMAIL}</li>
          <li>Timestamp: ${new Date().toISOString()}</li>
        </ul>
        <p><strong>Enhanced Features:</strong></p>
        <ul>
          <li>✅ Management links in all emails</li>
          <li>✅ Subscription management via direct links</li>
          <li>✅ Professional email templates</li>
        </ul>
      `).replace("{{unsubscribe_token}}", "test-token"),
      text: `Test Email - OVH VPS Monitor\n\nThis is a test email sent at ${new Date().toISOString()}`,
    });

    return true;
  } catch (error) {
    logger.error("Test email failed:", error);
    return false;
  }
};
