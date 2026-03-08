import type { PrismaClient } from "@isytask/db";

interface WhatsAppMessageParams {
  db: PrismaClient;
  to: string; // Phone number in E.164 format (e.g., +521234567890)
  body: string;
  templateName?: string;
}

/**
 * Send a WhatsApp message via Twilio API.
 *
 * Requires the following system config keys:
 * - twilio_account_sid
 * - twilio_auth_token
 * - twilio_whatsapp_from (e.g., "whatsapp:+14155238886" for sandbox)
 * - notification_whatsapp_enabled (boolean)
 *
 * For production: use Twilio WhatsApp Business API with approved templates.
 * For testing: use Twilio Sandbox (join sandbox first).
 */
export async function sendWhatsAppMessage({
  db,
  to,
  body,
}: WhatsAppMessageParams): Promise<boolean> {
  try {
    // Check if WhatsApp is enabled
    const enabledConfig = await db.systemConfig.findUnique({
      where: { key: "notification_whatsapp_enabled" },
    });
    if (enabledConfig?.value !== true) return false;

    // Get Twilio credentials from config
    const [sidConfig, tokenConfig, fromConfig] = await Promise.all([
      db.systemConfig.findUnique({ where: { key: "twilio_account_sid" } }),
      db.systemConfig.findUnique({ where: { key: "twilio_auth_token" } }),
      db.systemConfig.findUnique({ where: { key: "twilio_whatsapp_from" } }),
    ]);

    const accountSid = sidConfig?.value as string;
    const authToken = tokenConfig?.value as string;
    const fromNumber = (fromConfig?.value as string) || "whatsapp:+14155238886";

    if (!accountSid || !authToken) {
      console.warn("[WhatsApp] Missing Twilio credentials");
      return false;
    }

    // Clean and format phone number
    const cleanTo = to.replace(/\s+/g, "").replace(/^(\+)/, "");
    const whatsappTo = `whatsapp:+${cleanTo}`;
    const whatsappFrom = fromNumber.startsWith("whatsapp:")
      ? fromNumber
      : `whatsapp:${fromNumber}`;

    // Dynamic import to avoid loading Twilio in environments where not needed
    const { Twilio } = await import("twilio");
    const client = new Twilio(accountSid, authToken);

    const message = await client.messages.create({
      body,
      from: whatsappFrom,
      to: whatsappTo,
    });

    console.log(`[WhatsApp] Sent to ${whatsappTo}: ${message.sid}`);
    return true;
  } catch (error) {
    console.error("[WhatsApp] Failed to send:", error);
    return false;
  }
}
