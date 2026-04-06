import type { PrismaClient } from "@isytask/db";
import crypto from "crypto";

/**
 * WhatsApp Business API Integration via Meta Cloud API
 *
 * Requires the following system config keys:
 * - meta_whatsapp_phone_number_id: Your WhatsApp Business Account phone number ID
 * - meta_whatsapp_business_account_id: Your WhatsApp Business Account ID
 * - meta_whatsapp_access_token: Your Meta/Facebook access token
 * - meta_whatsapp_webhook_token: Verification token for webhooks (you choose this)
 * - notification_whatsapp_business_enabled: boolean
 *
 * Setup in Meta/Facebook:
 * 1. Go to Business Manager → WhatsApp Business Account
 * 2. Get phone_number_id and access_token
 * 3. Configure webhook: https://isytask-web.vercel.app/api/webhooks/whatsapp-business
 * 4. Subscribe to messages webhook
 */

interface SendWhatsAppBusinessParams {
  db: PrismaClient;
  to: string; // Phone number in E.164 format (e.g., +521234567890)
  body: string;
  mediaUrl?: string; // Optional: image/document URL to send
  mediaType?: "image" | "document" | "video" | "audio";
}

interface WebhookMessage {
  from: string;
  body: string;
  messageId: string;
  timestamp: number;
  mediaUrl?: string;
  mediaContentType?: string;
  profileName?: string;
}

/**
 * Send a WhatsApp message via Meta's Cloud API
 */
export async function sendWhatsAppBusinessMessage({
  db,
  to,
  body,
  mediaUrl,
  mediaType,
}: SendWhatsAppBusinessParams): Promise<boolean> {
  try {
    // Check if WhatsApp Business is enabled
    const enabledConfig = await db.systemConfig.findUnique({
      where: { key: "notification_whatsapp_business_enabled" },
    });
    if (enabledConfig?.value !== true) return false;

    // Get Meta credentials
    const [phoneIdConfig, tokenConfig] = await Promise.all([
      db.systemConfig.findUnique({
        where: { key: "meta_whatsapp_phone_number_id" },
      }),
      db.systemConfig.findUnique({
        where: { key: "meta_whatsapp_access_token" },
      }),
    ]);

    const phoneNumberId = phoneIdConfig?.value as string;
    const accessToken = tokenConfig?.value as string;

    if (!phoneNumberId || !accessToken) {
      console.warn(
        "[WhatsApp Business] Missing Meta credentials (phone_number_id or access_token)"
      );
      return false;
    }

    // Clean phone number
    const cleanPhone = to.replace(/\s+/g, "").replace(/^(\+)/, "");

    const apiUrl = `https://graph.instagram.com/v18.0/${phoneNumberId}/messages`;

    // Build message payload
    const messagePayload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: mediaUrl ? "image" : "text",
    };

    if (mediaUrl) {
      // Send media message
      const mediaTypeMap: Record<string, string> = {
        image: "image",
        document: "document",
        video: "video",
        audio: "audio",
      };

      messagePayload[mediaTypeMap[mediaType || "image"]] = {
        link: mediaUrl,
      };

      // Add caption for images
      if (mediaType === "image" && body) {
        messagePayload.image.caption = body;
      }
    } else {
      // Send text message
      messagePayload.text = {
        body,
      };
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(messagePayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(
        "[WhatsApp Business] API Error:",
        response.status,
        errorData
      );
      return false;
    }

    const result = await response.json();
    console.log(
      `[WhatsApp Business] Sent to ${cleanPhone}:`,
      result.messages?.[0]?.id
    );
    return true;
  } catch (error) {
    console.error("[WhatsApp Business] Failed to send:", error);
    return false;
  }
}

/**
 * Validate Meta webhook signature
 */
export async function validateMetaSignature(
  signature: string | null,
  body: string,
  db: PrismaClient
): Promise<boolean> {
  if (!signature) return false;

  const tokenConfig = await db.systemConfig.findUnique({
    where: { key: "meta_whatsapp_webhook_token" },
  });

  const webhookToken = (tokenConfig?.value as string) || "";
  if (!webhookToken) {
    console.warn(
      "[WhatsApp Business] No webhook token configured, skipping validation"
    );
    return process.env.NODE_ENV === "development";
  }

  const hash = crypto
    .createHmac("sha256", webhookToken)
    .update(body)
    .digest("hex");

  return signature === `sha256=${hash}`;
}

/**
 * Parse inbound message from Meta webhook
 */
export function parseMetaWebhook(jsonBody: any): WebhookMessage | null {
  try {
    // Meta sends messages nested in entry → changes → value → messages
    const entry = jsonBody.entry?.[0];
    if (!entry) return null;

    const changes = entry.changes?.[0];
    if (!changes) return null;

    const value = changes.value;
    const message = value?.messages?.[0];
    if (!message) return null;

    const contact = value?.contacts?.[0];
    const profileName = contact?.profile?.name;

    // Extract message content
    let body = "";
    let mediaUrl: string | undefined;
    let mediaContentType: string | undefined;

    if (message.type === "text") {
      body = message.text?.body || "";
    } else if (message.type === "image") {
      mediaUrl = message.image?.link;
      mediaContentType = "image/jpeg";
      body = message.image?.caption || "[Image]";
    } else if (message.type === "document") {
      mediaUrl = message.document?.link;
      mediaContentType = "application/pdf";
      body = message.document?.caption || "[Document]";
    } else if (message.type === "video") {
      mediaUrl = message.video?.link;
      mediaContentType = "video/mp4";
      body = "[Video]";
    } else if (message.type === "audio") {
      mediaUrl = message.audio?.link;
      mediaContentType = "audio/ogg";
      body = "[Audio]";
    } else {
      console.warn("[WhatsApp Business] Unknown message type:", message.type);
      return null;
    }

    return {
      from: message.from,
      body: body || "[No content]",
      messageId: message.id,
      timestamp: parseInt(message.timestamp) * 1000, // Convert to ms
      mediaUrl,
      mediaContentType,
      profileName,
    };
  } catch (error) {
    console.error("[WhatsApp Business] Failed to parse webhook:", error);
    return null;
  }
}

/**
 * Mark message as read in Meta API
 */
export async function markMessageAsRead(
  messageId: string,
  db: PrismaClient
): Promise<boolean> {
  try {
    const [phoneIdConfig, tokenConfig] = await Promise.all([
      db.systemConfig.findUnique({
        where: { key: "meta_whatsapp_phone_number_id" },
      }),
      db.systemConfig.findUnique({
        where: { key: "meta_whatsapp_access_token" },
      }),
    ]);

    const phoneNumberId = phoneIdConfig?.value as string;
    const accessToken = tokenConfig?.value as string;

    if (!phoneNumberId || !accessToken) return false;

    const response = await fetch(
      `https://graph.instagram.com/v18.0/${phoneNumberId}/mark_message_as_read`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message_id: messageId,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[WhatsApp Business] Mark read error:", errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[WhatsApp Business] Mark read failed:", error);
    return false;
  }
}
