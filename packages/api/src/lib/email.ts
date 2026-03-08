import type { PrismaClient } from "@isytask/db";

interface SendEmailParams {
  db: PrismaClient;
  to: string;
  subject: string;
  title: string;
  body: string;
  taskId?: string;
  actionUrl?: string;
  actionLabel?: string;
}

/** Get a config value from the database or return default */
async function getConfig(db: PrismaClient, key: string, defaultValue: any = null) {
  const config = await db.systemConfig.findUnique({ where: { key } });
  return config?.value ?? defaultValue;
}

/**
 * Build a branded HTML email template.
 */
function buildEmailHtml({
  title,
  body,
  companyName,
  actionUrl,
  actionLabel,
}: {
  title: string;
  body: string;
  companyName: string;
  actionUrl?: string;
  actionLabel?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#16a34a;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${companyName}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#18181b;font-size:18px;font-weight:600;">${title}</h2>
              <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">${body}</p>
              ${actionUrl ? `
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#16a34a;border-radius:8px;">
                    <a href="${actionUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">${actionLabel || "Ver en Isytask"}</a>
                  </td>
                </tr>
              </table>
              ` : ""}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
                Este email fue enviado por ${companyName} a través de Isytask.
                <br>Si no deseas recibir estas notificaciones, puedes desactivarlas en tu perfil.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Send an email notification using Resend.
 * Returns true if sent successfully, false otherwise.
 */
export async function sendEmailNotification({
  db,
  to,
  subject,
  title,
  body,
  taskId,
  actionUrl,
  actionLabel,
}: SendEmailParams): Promise<boolean> {
  try {
    // Check if email notifications are enabled
    const emailEnabled = await getConfig(db, "notification_email_enabled", true);
    if (!emailEnabled) return false;

    // Get Resend API key
    const apiKey = await getConfig(db, "resend_api_key", "");
    if (!apiKey) return false;

    // Get email settings
    const fromAddress = await getConfig(db, "email_from_address", "noreply@isytask.com");
    const fromName = await getConfig(db, "email_from_name", "Isytask");
    const companyName = await getConfig(db, "company_name", "Isytask");

    // Build HTML email
    const html = buildEmailHtml({
      title,
      body,
      companyName,
      actionUrl,
      actionLabel,
    });

    // Dynamic import of Resend to avoid issues in environments where it's not needed
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error("[Email] Send failed:", result.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Email] Error sending email:", error);
    return false;
  }
}
