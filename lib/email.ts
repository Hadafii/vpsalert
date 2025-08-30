import nodemailer from "nodemailer";
import { StatusChange, EmailDigest } from "./queries";
import { logger } from "@/lib/logs";

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

interface DigestEmailData {
  email: string;
  unsubscribeToken: string;
  vpsUpdates: Array<{
    model: number;
    datacenter: string;
    statusChange: StatusChange;
  }>;
}

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

  transporter.verify((error) => {
    if (error) {
      logger.error("SMTP configuration error:", error);
    } else {
      logger.log("SMTP server ready");
    }
  });

  return transporter;
};

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

const DATACENTER_INFO: Record<
  string,
  { name: string; country: string; flag: string }
> = {
  GRA: { name: "Gravelines", country: "France", flag: "🇫🇷" },
  SBG: { name: "Strasbourg", country: "France", flag: "🇫🇷" },
  BHS: { name: "Beauharnois", country: "Canada", flag: "🇨🇦" },
  WAW: { name: "Warsaw", country: "Poland", flag: "🇵🇱" },
  UK: { name: "London", country: "United Kingdom", flag: "🇬🇧" },
  DE: { name: "Frankfurt", country: "Germany", flag: "🇩🇪" },
  FR: { name: "Roubaix", country: "France", flag: "🇫🇷" },
  SGP: { name: "Singapore", country: "Singapore", flag: "🇸🇬" },
  SYD: { name: "Sydney", country: "Australia", flag: "🇦🇺" },
};

const getBaseTemplate = (content: string): string => `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>VPS Alert - OVH VPS Monitoring</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
  
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

const getDigestTemplate = (data: DigestEmailData): EmailTemplate => {
  const vpsCount = data.vpsUpdates.length;
  const totalServers = vpsCount;

  const vpsCardsHtml = data.vpsUpdates
    .map((update) => {
      const vpsModel = VPS_MODELS[update.model];
      const datacenterInfo = DATACENTER_INFO[update.datacenter];

      return `
    <!-- VPS Card -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; margin-bottom: 16px; overflow: hidden;">
      <tr>
        <td style="padding: 20px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td>
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td>
                      <h3 style="color: #065f46; margin: 0 0 8px 0; font-size: 18px; font-weight: 700;">
                        🖥️ ${vpsModel.name} - Available Now!
                      </h3>
                    </td>
                    <td align="right">
                      <span style="background-color: #10b981; color: #ffffff; padding: 6px 12px; border-radius: 50px; font-weight: 600; font-size: 14px;">
                        ${vpsModel.price}/month
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 12px;">
                <table border="0" cellpadding="4" cellspacing="0" width="100%">
                  <tr>
                    <td width="50%" style="color: #047857; font-size: 14px;">
                      💾 ${vpsModel.specs.split(", ")[0]}
                    </td>
                    <td width="50%" style="color: #047857; font-size: 14px;">
                      🧠 ${vpsModel.specs.split(", ")[1]}
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #047857; font-size: 14px;">
                      💽 ${vpsModel.specs.split(", ")[2]}
                    </td>
                    <td style="color: #047857; font-size: 14px;">
                      📶 Unlimited bandwidth
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 16px; border-top: 1px solid #a7f3d0;">
                <p style="margin: 0; color: #065f46; font-weight: 600; font-size: 15px;">
                  ${datacenterInfo?.flag || "🌍"} Datacenter: <strong>${update.datacenter}</strong> - ${datacenterInfo?.name || update.datacenter}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    `;
    })
    .join("");

  const textContent = data.vpsUpdates
    .map((update) => {
      const vpsModel = VPS_MODELS[update.model];
      const datacenterInfo = DATACENTER_INFO[update.datacenter];
      return `• ${vpsModel.name} (${vpsModel.specs}) - ${update.datacenter} - ${datacenterInfo?.name} - ${vpsModel.price}/month`;
    })
    .join("\n");

  const html = getBaseTemplate(`
    <!-- Alert Header -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="16" cellspacing="0" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50px; display: inline-block;">
            <tr>
              <td style="color: #ffffff; font-weight: 700; font-size: 20px; text-align: center;">
                🎉 ${vpsCount} VPS${vpsCount > 1 ? " Servers" : ""} Available Now!
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Summary Message -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
      <tr>
        <td align="center">
          <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 24px; font-weight: 700;">
            Great News! Your VPS${vpsCount > 1 ? " Servers Are" : " is"} Available
          </h2>
          <p style="color: #64748b; margin: 0; font-size: 16px; line-height: 1.5; max-width: 500px;">
            ${
              vpsCount > 1
                ? `${vpsCount} VPS configurations you're monitoring have just become available for immediate deployment.`
                : "The VPS configuration you're monitoring has just become available for immediate deployment."
            }
          </p>
        </td>
      </tr>
    </table>

    <!-- VPS Cards -->
    ${vpsCardsHtml}

    <!-- Call to Action -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fed7aa; border-left: 4px solid #f59e0b; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 24px; text-align: center;">
          <h3 style="color: #92400e; margin: 0 0 16px 0; font-size: 18px; font-weight: 700;">
            ⚡ Act Fast - Limited Availability!
          </h3>
          <p style="color: #78350f; margin: 0 0 24px 0; font-size: 15px; line-height: 1.5;">
            VPS servers can go out of stock quickly. We recommend securing your server${vpsCount > 1 ? "s" : ""} as soon as possible.
          </p>
          
          <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50px; padding: 2px;">
                <a href="https://www.ovhcloud.com/en/vps/" style="display: block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 18px; padding: 16px 32px; border-radius: 50px;">
                  🛒 Order Now at OVH
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Management Section -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="padding-top: 32px; border-top: 1px solid #e2e8f0;">
      <tr>
        <td>
          <h4 style="color: #0f172a; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">
            ⚙️ Manage Your Monitoring
          </h4>
          <p style="color: #64748b; margin: 0 0 20px 0; font-size: 15px; line-height: 1.5;">
            Want to add more VPS models to monitor or modify your notification preferences?
          </p>
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
                        📊 View Dashboard
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
    subject: `🎉 ${vpsCount} VPS Server${vpsCount > 1 ? "s" : ""} Available Now! ${data.vpsUpdates.map((u) => VPS_MODELS[u.model].name).join(", ")}`,
    html: html.replace(/{{unsubscribe_token}}/g, data.unsubscribeToken),
    text: `VPS Alert - Multiple Servers Available!\n\n🎉 Great news! ${vpsCount} VPS server${vpsCount > 1 ? "s" : ""} you're monitoring ${vpsCount > 1 ? "are" : "is"} now available:\n\n${textContent}\n\n⚡ Act Fast: VPS servers can go out of stock quickly. We recommend securing your server${vpsCount > 1 ? "s" : ""} immediately.\n\n🛒 Order now: https://www.ovhcloud.com/en/vps/\n\nManage your monitoring:\n• Dashboard: ${process.env.NEXT_PUBLIC_APP_URL}\n• Manage Subscriptions: ${process.env.NEXT_PUBLIC_APP_URL}/manage/${data.unsubscribeToken}\n• Unsubscribe: ${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe/${data.unsubscribeToken}\n\nVPS Alert Team\n${process.env.NEXT_PUBLIC_APP_URL}`,
  };
};

const getNotificationTemplate = (
  data: NotificationEmailData
): EmailTemplate => {
  const vpsModel = VPS_MODELS[data.model];
  const datacenterInfo = DATACENTER_INFO[data.datacenter];
  const ovhUrl = `https://www.ovhcloud.com/en/vps/`;

  const html = getBaseTemplate(`
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="12" cellspacing="0" style="background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 50px; display: inline-block;">
            <tr>
              <td style="color: #065f46; font-weight: 700; font-size: 18px; text-align: center;">
                🎉 VPS Available Now!
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 24px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
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
          
          <table border="0" cellpadding="8" cellspacing="0" width="100%" style="margin: 16px 0;">
            <tr>
              <td width="50%" style="color: #64748b; font-size: 14px;">💾 ${vpsModel.specs.split(", ")[0]}</td>
              <td width="50%" style="color: #64748b; font-size: 14px;">🧠 ${vpsModel.specs.split(", ")[1]}</td>
            </tr>
            <tr>
              <td style="color: #64748b; font-size: 14px;">💽 ${vpsModel.specs.split(", ")[2]}</td>
              <td style="color: #64748b; font-size: 14px;">📶 Unlimited bandwidth</td>
            </tr>
          </table>

          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="padding-top: 16px; border-top: 1px solid #e2e8f0;">
            <tr>
              <td>
                <p style="margin: 0; color: #1e293b; font-weight: 600; font-size: 16px;">
                  ${datacenterInfo?.flag || "🌍"} Datacenter: <strong>${data.datacenter}</strong> - ${datacenterInfo?.name || data.datacenter}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
      <tr>
        <td align="center">
          <h3 style="color: #065f46; margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">
            🚀 Ready for Immediate Deployment!
          </h3>
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
      </tr>
    </table>
  `);

  return {
    subject: `🎉 ${vpsModel.name} Available in ${datacenterInfo?.name || data.datacenter}!`,
    html: html.replace(/{{unsubscribe_token}}/g, data.unsubscribeToken),
    text: `VPS Alert - Server Available!\n\n🎉 Great news! ${vpsModel.name} is now available in ${datacenterInfo?.name || data.datacenter}.\n\nSpecs: ${vpsModel.specs}\nPrice: ${vpsModel.price}/month\nDatacenter: ${data.datacenter} - ${datacenterInfo?.name}\n\n🛒 Order now: ${ovhUrl}\n\nVPS Alert Team\n${process.env.NEXT_PUBLIC_APP_URL}`,
  };
};

const getVerificationTemplate = (
  data: VerificationEmailData
): EmailTemplate => {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify/${data.verificationToken}`;

  const html = getBaseTemplate(`
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
  `);

  return {
    subject: "✅ Verify your VPS Alert subscription",
    html: html.replace(/{{unsubscribe_token}}/g, ""),
    text: `Welcome to VPS Alert!\n\nVerify your email: ${verificationUrl}\n\nVPS Alert Team`,
  };
};

export const sendDigestEmail = async (
  digestData: EmailDigest
): Promise<boolean> => {
  try {
    const transporter = createTransporter();

    const emailData: DigestEmailData = {
      email: digestData.email,
      unsubscribeToken: digestData.unsubscribe_token,
      vpsUpdates: digestData.notifications.map((notif) => ({
        model: notif.model,
        datacenter: notif.datacenter,
        statusChange: notif.status_change,
      })),
    };

    const template = getDigestTemplate(emailData);

    await transporter.sendMail({
      from: {
        name: "VPS Alert",
        address: process.env.FROM_EMAIL || "noreply@vpsalert.online",
      },
      to: digestData.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      headers: {
        "Message-ID": `<digest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@vpsalert.online>`,
        Date: new Date().toUTCString(),
        "X-Mailer": "VPS Alert Digest System",
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        Importance: "high",
        "List-Unsubscribe": `<${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe/${digestData.unsubscribe_token}>`,
        "List-ID": "VPS Alert Notifications <notifications.vpsalert.online>",
        "X-Auto-Response-Suppress": "OOF, DR, RN, NRN, AutoReply",
        "Auto-Submitted": "auto-generated",
        "X-Category": "vps-digest",
        "X-VPS-Count": digestData.notifications.length.toString(),
      },
    });

    logger.log(
      `Digest email sent to ${digestData.email} with ${digestData.notifications.length} VPS updates`
    );
    return true;
  } catch (error) {
    logger.error("Failed to send digest email:", error);
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
        "Message-ID": `<${Date.now()}-${Math.random().toString(36).substr(2, 9)}@vpsalert.online>`,
        Date: new Date().toUTCString(),
        "X-Mailer": "VPS Alert Notification System",
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        Importance: "high",
        "List-Unsubscribe": `<${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe/${data.unsubscribeToken}>`,
        "Auto-Submitted": "auto-generated",
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
    });

    logger.log(`Verification email sent to ${data.email}`);
    return true;
  } catch (error) {
    logger.error("Failed to send verification email:", error);
    return false;
  }
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 320;
};

export const sendManagementEmail = async (
  email: string,
  managementToken: string
): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    const managementUrl = `${process.env.NEXT_PUBLIC_APP_URL}/manage/${managementToken}`;

    const html = getBaseTemplate(`
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
        <tr>
          <td align="center">
            <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 24px; font-weight: 700;">
              ⚙️ Access Your Subscription Dashboard
            </h2>
            <p style="color: #64748b; margin: 0; font-size: 16px; line-height: 1.5;">
              Click the button below to manage your OVH VPS availability notifications.
            </p>
          </td>
        </tr>
      </table>

      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 50px; padding: 2px;">
                  <a href="${managementUrl}" style="display: block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 16px 32px; border-radius: 50px; text-align: center;">
                    ⚙️ Manage Subscriptions
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fed7aa; border-left: 4px solid #f59e0b; border-radius: 8px; margin-bottom: 24px;">
        <tr>
          <td style="padding: 16px;">
            <p style="color: #92400e; margin: 0; font-weight: 600; font-size: 14px;">
              🔐 <strong>Security Note:</strong> This link is personal to your email address. 
              Don't share it with others as it provides access to modify your notification preferences.
            </p>
          </td>
        </tr>
      </table>

      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
        <tr>
          <td>
            <h4 style="color: #0f172a; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">
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
          </td>
        </tr>
      </table>

      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-left: 4px solid #10b981; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <tr>
          <td>
            <p style="color: #047857; margin: 0; font-size: 14px;">
              📌 <strong>Pro Tip:</strong> This link doesn't expire and can be bookmarked for easy access to your dashboard anytime!
            </p>
          </td>
        </tr>
      </table>
    `);

    await transporter.sendMail({
      from: {
        name: "VPS Alert",
        address: process.env.FROM_EMAIL || "noreply@vpsalert.online",
      },
      to: email,
      subject: "🔗 Access Your VPS Subscription Dashboard",
      html: html.replace(/{{unsubscribe_token}}/g, managementToken),
      text: `VPS Alert - Manage Your Subscriptions\n\nAccess your subscription dashboard: ${managementUrl}\n\nWhat you can do:\n• View all your active subscriptions\n• Add new VPS models and datacenters to monitor\n• Remove subscriptions you no longer need\n• Update your notification preferences\n\nSecurity Note: This link is personal to your email address. Don't share it with others.\n\nThis link doesn't expire and can be bookmarked for future use.\n\nVPS Alert Team\n${process.env.NEXT_PUBLIC_APP_URL}`,
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

export const sendEmailBatch = async (
  emails: NotificationEmailData[],
  batchSize: number = 5,
  delayMs: number = 2000
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

    if (i + batchSize < emails.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { sent, failed };
};
