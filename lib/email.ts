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
  SGP: "Singapore",
  SYD: "Sydney, Australia",
};

// ====================================
// EMAIL-SAFE TEMPLATES (INLINE CSS, NO EXTERNAL RESOURCES)
// ====================================

const getBaseTemplate = (content: string): string => `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>VPS Alert - OVH VPS Monitoring</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
  
  <!-- Email Container -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 20px 0;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="680" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1); overflow: hidden;">
          
          <!-- Header Section -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <!-- Logo Text (Safe SVG alternative) -->
                    <div style="background-color: #ffffff; padding: 12px 24px; border-radius: 50px; display: inline-block; margin-bottom: 16px;">
                      <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                        VPS <span style="color: #3b82f6;">ALERT</span>
                      </h1>
                    </div>
                    <h2 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">
                      Real-time OVH VPS Monitor
                    </h2>
                    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">
                      Instant notifications when VPS becomes available
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content Section -->
          <tr>
            <td style="padding: 40px 32px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer Section -->
          <tr>
            <td style="background-color: #f8fafc; padding: 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <!-- Footer Links -->
                    <table border="0" cellpadding="8" cellspacing="8" style="margin-bottom: 20px;">
                      <tr>
                        <td>
                          <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color: #3b82f6; text-decoration: none; font-weight: 600; padding: 8px 16px; border: 1px solid #3b82f6; border-radius: 6px; font-size: 14px;">
                            📊 Dashboard
                          </a>
                        </td>
                        <td>
                          <a href="${process.env.NEXT_PUBLIC_APP_URL}/manage/{{unsubscribe_token}}" style="color: #3b82f6; text-decoration: none; font-weight: 600; padding: 8px 16px; border: 1px solid #3b82f6; border-radius: 6px; font-size: 14px;">
                            ⚙️ Manage
                          </a>
                        </td>
                        <td>
                          <a href="${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe/{{unsubscribe_token}}" style="color: #64748b; text-decoration: none; font-weight: 600; padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px;">
                            ❌ Unsubscribe
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Footer Text -->
                    <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">
                      You received this email because you subscribed to OVH VPS availability notifications.
                    </p>
                    <p style="color: #64748b; font-size: 12px; line-height: 1.4; margin: 0;">
                      🛡️ This service is not affiliated with OVH. We monitor publicly available data to provide notifications.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const getVerificationTemplate = (
  data: VerificationEmailData
): EmailTemplate => {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify/${data.verificationToken}`;

  const html = getBaseTemplate(`
    <!-- Welcome Message -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
      <tr>
        <td style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-left: 4px solid #10b981; border-radius: 8px; padding: 20px;">
          <h2 style="color: #065f46; margin: 0 0 12px 0; font-size: 22px; font-weight: 700;">
            🎉 Welcome to VPS Alert!
          </h2>
          <p style="color: #047857; margin: 0; font-size: 16px; line-height: 1.5;">
            Thank you for subscribing to OVH VPS availability notifications.
          </p>
        </td>
      </tr>
    </table>

    <!-- Verification CTA -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
      <tr>
        <td align="center">
          <h3 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
            Activate Your Subscription
          </h3>
          <p style="color: #64748b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.5;">
            Click the button below to verify your email address and start receiving instant notifications.
          </p>
          
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 50px; padding: 2px;">
                <a href="${verificationUrl}" style="display: block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 16px 32px; border-radius: 50px; text-align: center;">
                  ✅ Verify Email Address
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Alternative Link -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
      <tr>
        <td style="background-color: #fffbeb; border: 1px solid #fed7aa; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px;">
          <p style="color: #92400e; margin: 0 0 8px 0; font-weight: 600; font-size: 14px;">
            🔗 Alternative Verification Link:
          </p>
          <p style="color: #78350f; margin: 0; font-size: 12px; word-break: break-all; background-color: #ffffff; padding: 8px; border-radius: 4px; font-family: monospace;">
            ${verificationUrl}
          </p>
        </td>
      </tr>
    </table>

    <!-- Features List -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td>
          <h4 style="color: #0f172a; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">
            🚀 What happens next?
          </h4>
          
          <table border="0" cellpadding="4" cellspacing="0" width="100%">
            <tr>
              <td width="30" style="vertical-align: top; padding-top: 4px;">⚡</td>
              <td style="color: #475569; font-size: 15px; line-height: 1.5; padding-bottom: 8px;">
                Get instant notifications when your selected VPS models become available
              </td>
            </tr>
            <tr>
              <td width="30" style="vertical-align: top; padding-top: 4px;">⏰</td>
              <td style="color: #475569; font-size: 15px; line-height: 1.5; padding-bottom: 8px;">
                Real-time monitoring every 30 seconds across all OVH datacenters
              </td>
            </tr>
            <tr>
              <td width="30" style="vertical-align: top; padding-top: 4px;">⚙️</td>
              <td style="color: #475569; font-size: 15px; line-height: 1.5; padding-bottom: 8px;">
                Manage your subscriptions anytime through our dashboard
              </td>
            </tr>
            <tr>
              <td width="30" style="vertical-align: top; padding-top: 4px;">📱</td>
              <td style="color: #475569; font-size: 15px; line-height: 1.5;">
                Mobile-friendly email alerts with direct purchase links
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `);

  return {
    subject:
      "✅ Verify your VPS Alert subscription - Get instant VPS notifications",
    html: html.replace(/{{unsubscribe_token}}/g, ""),
    text: `Welcome to VPS Alert!\n\nThank you for subscribing to OVH VPS availability notifications.\n\nTo activate your subscription, please verify your email address by visiting:\n${verificationUrl}\n\nWhat happens next:\n• Get instant notifications when your selected VPS models become available\n• Real-time monitoring every 30 seconds across all OVH datacenters\n• Manage your subscriptions anytime through our dashboard\n• Mobile-friendly email alerts with direct purchase links\n\nIf you have any questions, please visit our dashboard or contact support.\n\nVPS Alert Team\n${process.env.NEXT_PUBLIC_APP_URL}`,
  };
};

const getNotificationTemplate = (
  data: NotificationEmailData
): EmailTemplate => {
  const vpsModel = VPS_MODELS[data.model];
  const datacenterName = DATACENTER_NAMES[data.datacenter] || data.datacenter;
  const isAvailable = data.statusChange === "became_available";

  const statusText = isAvailable ? "AVAILABLE NOW" : "OUT OF STOCK";
  const emoji = isAvailable ? "🎉" : "⏳";

  const ovhUrl = `https://www.ovhcloud.com/en/vps/`;

  // Datacenter flag mapping
  const datacenterFlags: Record<string, string> = {
    GRA: "🇫🇷",
    SBG: "🇫🇷",
    BHS: "🇨🇦",
    WAW: "🇵🇱",
    UK: "🇬🇧",
    DE: "🇩🇪",
    FR: "🇫🇷",
    SGP: "🇸🇬",
    SYD: "🇦🇺",
  };

  const html = getBaseTemplate(`
    <!-- Status Header -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="12" cellspacing="0" style="background-color: ${isAvailable ? "#ecfdf5; border: 2px solid #10b981" : "#fef2f2; border: 2px solid #ef4444"}; border-radius: 50px; display: inline-block;">
            <tr>
              <td style="color: ${isAvailable ? "#065f46" : "#991b1b"}; font-weight: 700; font-size: 18px; text-align: center;">
                ${emoji} VPS Status Update
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- VPS Details Card -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 24px;">
          
          <!-- VPS Title -->
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
            <tr>
              <td>
                <h2 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 700;">
                  🖥️ ${vpsModel.name}
                </h2>
              </td>
              <td align="right">
                <span style="background-color: #3b82f6; color: #ffffff; padding: 6px 12px; border-radius: 50px; font-weight: 600; font-size: 14px;">
                  ${vpsModel.price}/month
                </span>
              </td>
            </tr>
          </table>
          
          <!-- Specs Grid -->
          <table border="0" cellpadding="8" cellspacing="0" width="100%" style="margin-bottom: 16px;">
            <tr>
              <td width="50%" style="color: #64748b; font-size: 14px;">
                💾 ${vpsModel.specs.split(", ")[0]}
              </td>
              <td width="50%" style="color: #64748b; font-size: 14px;">
                🧠 ${vpsModel.specs.split(", ")[1]}
              </td>
            </tr>
            <tr>
              <td style="color: #64748b; font-size: 14px;">
                💽 ${vpsModel.specs.split(", ")[2]}
              </td>
              <td style="color: #64748b; font-size: 14px;">
                📶 Unlimited bandwidth
              </td>
            </tr>
          </table>

          <!-- Datacenter Info -->
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="padding-top: 16px; border-top: 1px solid #e2e8f0;">
            <tr>
              <td>
                <p style="margin: 0; color: #1e293b; font-weight: 600; font-size: 16px;">
                  ${datacenterFlags[data.datacenter] || "🌍"} Datacenter: <strong>${data.datacenter}</strong> - ${datacenterName}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 12px;">
                <span style="background-color: ${isAvailable ? "#10b981" : "#ef4444"}; color: #ffffff; padding: 8px 16px; border-radius: 50px; font-weight: 700; font-size: 16px;">
                  Status: ${statusText}
                </span>
              </td>
            </tr>
          </table>
          
        </td>
      </tr>
    </table>
    
    ${
      isAvailable
        ? `
    <!-- Success Message -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-left: 4px solid #10b981; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 24px;">
          <h3 style="color: #065f46; margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">
            🚀 Great news! This VPS is now available!
          </h3>
          <p style="color: #047857; margin: 0 0 24px 0; font-size: 16px; line-height: 1.5;">
            Your preferred VPS configuration is now in stock and ready for immediate deployment.
          </p>
          
          <table border="0" cellpadding="8" cellspacing="8" align="center">
            <tr>
              <td>
                <table border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50px; padding: 2px;">
                      <a href="${ovhUrl}" style="display: block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 28px; border-radius: 50px;">
                        🛒 Order Now at OVH
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
              <td>
                <table border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border: 2px solid #3b82f6; border-radius: 50px;">
                      <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="display: block; color: #3b82f6; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 28px;">
                        📊 View All Status
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <!-- Warning Note -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fed7aa; border-left: 4px solid #f59e0b; border-radius: 8px; margin-bottom: 32px;">
      <tr>
        <td style="padding: 16px;">
          <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
            ⚠️ <strong>Act Fast:</strong> VPS availability can change quickly. We recommend ordering as soon as possible to secure your server.
          </p>
        </td>
      </tr>
    </table>
    `
        : `
    <!-- Out of Stock Message -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
      <tr>
        <td align="center" style="padding: 24px;">
          <p style="color: #64748b; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
            This VPS model is currently out of stock in the ${datacenterName} datacenter.
          </p>
          <p style="color: #1e293b; margin: 0 0 24px 0; font-size: 16px; font-weight: 600;">
            🔔 Don't worry - we'll notify you immediately when it becomes available again!
          </p>
          
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td style="border: 2px solid #3b82f6; border-radius: 50px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="display: block; color: #3b82f6; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 28px;">
                  🔍 Check Other Datacenters
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    `
    }
    
    <!-- Management Links -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="padding-top: 32px; border-top: 1px solid #e2e8f0;">
      <tr>
        <td>
          <h4 style="color: #0f172a; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">
            ⚙️ Want to modify your notifications?
          </h4>
        </td>
      </tr>
      <tr>
        <td align="center">
          <table border="0" cellpadding="8" cellspacing="8">
            <tr>
              <td>
                <table border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border: 2px solid #3b82f6; border-radius: 50px;">
                      <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="display: block; color: #3b82f6; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 20px;">
                        📊 Dashboard
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
              <td>
                <table border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border: 2px solid #3b82f6; border-radius: 50px;">
                      <a href="${process.env.NEXT_PUBLIC_APP_URL}/manage/{{unsubscribe_token}}" style="display: block; color: #3b82f6; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 20px;">
                        ⚙️ Manage Subscriptions
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `);

  return {
    subject: `${emoji} ${vpsModel.name} is ${statusText} in ${datacenterName}`,
    html: html.replace(/{{unsubscribe_token}}/g, data.unsubscribeToken),
    text: `VPS Alert - Status Update\n\n${vpsModel.name} (${vpsModel.specs}) in ${datacenterName} is ${statusText}.\n\n${isAvailable ? `🎉 Great news! This VPS is now available for purchase.\n\nOrder now: ${ovhUrl}\n\n⚠️ Note: Availability can change quickly. We recommend ordering as soon as possible.` : `⏳ This VPS model is currently out of stock. We'll notify you as soon as it becomes available again.`}\n\nManage your notifications:\n• Dashboard: ${process.env.NEXT_PUBLIC_APP_URL}\n• Manage Subscriptions: ${process.env.NEXT_PUBLIC_APP_URL}/manage/${data.unsubscribeToken}\n• Unsubscribe: ${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe/${data.unsubscribeToken}\n\nVPS Alert Team\n${process.env.NEXT_PUBLIC_APP_URL}`,
  };
};

// ====================================
// EMAIL SENDING FUNCTIONS WITH ENHANCED HEADERS
// ====================================

export const sendVerificationEmail = async (
  data: VerificationEmailData
): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    const template = getVerificationTemplate(data);

    await transporter.sendMail({
      from: {
        name: "VPS Alert",
        address: process.env.FROM_EMAIL || "noreply@vpsalert.online",
      },
      to: data.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      headers: {
        // Anti-spam headers
        "Message-ID": `<${Date.now()}-${Math.random().toString(36).substr(2, 9)}@vpsalert.online>`,
        Date: new Date().toUTCString(),
        "X-Mailer": "VPS Alert Notification System",
        "X-Priority": "3",
        "X-MSMail-Priority": "Normal",
        Importance: "normal",
        // List headers for better deliverability
        "List-Unsubscribe": `<${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe>`,
        "List-ID": "VPS Alert Notifications <notifications.vpsalert.online>",
        // Content classification
        "X-Auto-Response-Suppress": "OOF, DR, RN, NRN, AutoReply",
        "Auto-Submitted": "auto-generated",
      },
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
        name: "VPS Alert",
        address: process.env.FROM_EMAIL || "noreply@vpsalert.online",
      },
      to: data.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      headers: {
        // Anti-spam headers
        "Message-ID": `<${Date.now()}-${Math.random().toString(36).substr(2, 9)}@vpsalert.online>`,
        Date: new Date().toUTCString(),
        "X-Mailer": "VPS Alert Notification System",
        "X-Priority": data.statusChange === "became_available" ? "1" : "3",
        "X-MSMail-Priority":
          data.statusChange === "became_available" ? "High" : "Normal",
        Importance:
          data.statusChange === "became_available" ? "high" : "normal",
        // List headers for better deliverability
        "List-Unsubscribe": `<${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe/${data.unsubscribeToken}>`,
        "List-ID": "VPS Alert Notifications <notifications.vpsalert.online>",
        // Content classification
        "X-Auto-Response-Suppress": "OOF, DR, RN, NRN, AutoReply",
        "Auto-Submitted": "auto-generated",
        // Category for better organization
        "X-Category": `vps-${data.statusChange}`,
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
  batchSize: number = 5, // Reduced batch size for better deliverability
  delayMs: number = 2000 // Increased delay
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
// MANAGEMENT EMAIL
// ====================================

export const sendManagementEmail = async (
  email: string,
  managementToken: string
): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    const managementUrl = `${process.env.NEXT_PUBLIC_APP_URL}/manage/${managementToken}`;

    const html = getBaseTemplate(`
      <div class="text-center mb-4">
        <h2 style="color: var(--navy-primary); margin: 0 0 16px 0; font-size: 24px; font-weight: 700;">
          ⚙️ Access Your Subscription Dashboard
        </h2>
        <p style="color: var(--text-light); margin: 0; font-size: 16px;">
          Click the button below to manage your OVH VPS availability notifications.
        </p>
      </div>

      <div class="text-center" style="margin: 32px 0;">
        <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 50px; padding: 2px;">
              <a href="${managementUrl}" style="display: block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 16px 32px; border-radius: 50px; text-align: center;">
                ⚙️ Manage Subscriptions
              </a>
            </td>
          </tr>
        </table>
      </div>

      <div class="warning-note">
        <p style="color: #92400e; margin: 0; font-weight: 600; font-size: 14px;">
          🔐 <strong>Security Note:</strong> This link is personal to your email address. 
          Don't share it with others as it provides access to modify your notification preferences.
        </p>
      </div>

      <div style="margin: 32px 0;">
        <h4 style="color: var(--navy-primary); margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">
          What you can do:
        </h4>
        
        <table border="0" cellpadding="4" cellspacing="0" width="100%">
          <tr>
            <td width="30" style="vertical-align: top; padding-top: 4px;">📋</td>
            <td style="color: #475569; font-size: 15px; line-height: 1.5; padding-bottom: 8px;">
              View all your active subscriptions and monitoring status
            </td>
          </tr>
          <tr>
            <td width="30" style="vertical-align: top; padding-top: 4px;">➕</td>
            <td style="color: #475569; font-size: 15px; line-height: 1.5; padding-bottom: 8px;">
              Add new VPS models and datacenters to monitor
            </td>
          </tr>
          <tr>
            <td width="30" style="vertical-align: top; padding-top: 4px;">🗑️</td>
            <td style="color: #475569; font-size: 15px; line-height: 1.5; padding-bottom: 8px;">
              Remove subscriptions you no longer need
            </td>
          </tr>
          <tr>
            <td width="30" style="vertical-align: top; padding-top: 4px;">🔔</td>
            <td style="color: #475569; font-size: 15px; line-height: 1.5;">
              Update your notification preferences
            </td>
          </tr>
        </table>
      </div>

      <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-left: 4px solid #10b981; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="color: #047857; margin: 0; font-size: 14px;">
          📌 <strong>Pro Tip:</strong> This link doesn't expire and can be bookmarked for easy access to your dashboard anytime!
        </p>
      </div>

      <div class="text-center" style="margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--border-color);">
        <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="border: 2px solid #3b82f6; border-radius: 50px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="display: block; color: #3b82f6; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px;">
                📊 Visit Main Dashboard
              </a>
            </td>
          </tr>
        </table>
      </div>
    `);

    await transporter.sendMail({
      from: {
        name: "VPS Alert",
        address: process.env.FROM_EMAIL || "noreply@vpsalert.online",
      },
      to: email,
      subject: "🔗 Access Your VPS Subscription Dashboard",
      html: html.replace(/{{unsubscribe_token}}/g, managementToken),
      text: `VPS Alert - Manage Your Subscriptions\n\nAccess your subscription dashboard to manage your OVH VPS availability notifications.\n\nManagement Link: ${managementUrl}\n\nWhat you can do:\n• View all your active subscriptions\n• Add new VPS models and datacenters to monitor\n• Remove subscriptions you no longer need\n• Update your notification preferences\n\nSecurity Note: This link is personal to your email address. Don't share it with others.\n\nThis link doesn't expire and can be bookmarked for future use.\n\nVPS Alert Team\n${process.env.NEXT_PUBLIC_APP_URL}`,
      headers: {
        "Message-ID": `<mgmt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@vpsalert.online>`,
        "X-Priority": "3",
        "X-MSMail-Priority": "Normal",
        "Auto-Submitted": "auto-generated",
      },
    });

    logger.log(`Management email sent to ${email}`);
    return true;
  } catch (error) {
    logger.error("Failed to send management email:", error);
    return false;
  }
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
