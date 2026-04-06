import { NextResponse } from "next/server";
import { db } from "@isytask/db";
import {
  validateMetaSignature,
  parseMetaWebhook,
  markMessageAsRead,
} from "@isytask/api";
import { handleInboundWhatsApp } from "@isytask/api";

/**
 * Meta/Facebook WhatsApp Business API Webhook
 *
 * Receives inbound WhatsApp messages from Meta's Cloud API.
 * Meta sends JSON POST requests with webhook events.
 *
 * Setup in Meta Business Manager:
 *   WhatsApp Business Account → Webhooks → Configuration
 *   Callback URL: https://isytask-web.vercel.app/api/webhooks/whatsapp-business
 *   Verify Token: (you set this in meta_whatsapp_webhook_token config)
 *   Subscribe to: messages, message_template_status_update
 *
 * Required SystemConfig keys:
 *   - meta_whatsapp_phone_number_id
 *   - meta_whatsapp_business_account_id
 *   - meta_whatsapp_access_token
 *   - meta_whatsapp_webhook_token (for signature validation)
 *   - notification_whatsapp_business_enabled
 */

// ─── GET: Webhook verification (Meta needs this) ───

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // Get the webhook token from config
    const tokenConfig = await db.systemConfig.findUnique({
      where: { key: "meta_whatsapp_webhook_token" },
    });

    const webhookToken = (tokenConfig?.value as string) || "";

    // Verify token
    if (mode === "subscribe" && token === webhookToken && challenge) {
      console.log("[WhatsApp Business Webhook] Verified");
      return new NextResponse(challenge, { status: 200 });
    }

    console.warn("[WhatsApp Business Webhook] Invalid verification request");
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  } catch (error) {
    console.error("[WhatsApp Business Webhook] Verification error:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 400 }
    );
  }
}

// ─── POST: Inbound webhook events ───

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const jsonBody = JSON.parse(rawBody);

    // Validate signature
    const signature = req.headers.get("x-hub-signature-256");
    const isValid = await validateMetaSignature(signature, rawBody, db);

    if (!isValid && process.env.NODE_ENV === "production") {
      console.error("[WhatsApp Business Webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 403 }
      );
    }

    // Parse webhook event
    if (jsonBody.object !== "whatsapp_business_account") {
      console.warn("[WhatsApp Business Webhook] Unknown object type");
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const message = parseMetaWebhook(jsonBody);

    if (!message) {
      console.log("[WhatsApp Business Webhook] No message in event");
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Check for duplicate messages
    const existing = await db.whatsAppMessage.findUnique({
      where: { metaMessageId: message.messageId },
    });

    if (existing) {
      console.log(
        `[WhatsApp Business Webhook] Duplicate message: ${message.messageId}`
      );
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Mark as read asynchronously
    markMessageAsRead(message.messageId, db).catch((err) => {
      console.error("[WhatsApp Business] Mark read error:", err);
    });

    // Process the inbound message asynchronously (fire-and-forget)
    // We respond to Meta immediately to avoid timeout
    handleInboundWhatsApp({
      db,
      message: {
        from: message.from,
        body: message.body,
        messageSid: message.messageId, // Use Meta message ID as identifier
        mediaUrl: message.mediaUrl,
        mediaContentType: message.mediaContentType,
        profileName: message.profileName,
      },
    }).catch((error) => {
      console.error("[WhatsApp Business Webhook] Handler error:", error);
    });

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[WhatsApp Business Webhook] Error:", error);
    // Still return 200 so Meta doesn't retry (we logged it)
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
