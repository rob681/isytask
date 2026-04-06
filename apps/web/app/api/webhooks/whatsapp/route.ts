import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@isytask/db";
import { handleInboundWhatsApp } from "@isytask/api";

/**
 * Twilio WhatsApp Webhook
 *
 * Receives inbound WhatsApp messages from Twilio.
 * Twilio sends messages as form-encoded POST requests.
 *
 * Setup in Twilio Console:
 *   WhatsApp Sandbox → "When a message comes in" →
 *   https://isytask-web.vercel.app/api/webhooks/whatsapp (POST)
 *
 * Required SystemConfig keys:
 *   - twilio_auth_token (for signature validation)
 *   - twilio_account_sid
 *   - twilio_whatsapp_from
 *   - notification_whatsapp_enabled
 */

// ─── Signature Validation ───

async function validateTwilioSignature(
  req: Request,
  body: URLSearchParams
): Promise<boolean> {
  const authToken = await getAuthToken();
  if (!authToken) {
    console.warn("[WhatsApp Webhook] No auth token — skipping validation in dev");
    return process.env.NODE_ENV === "development";
  }

  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;

  // Reconstruct the URL Twilio used to sign
  const url =
    process.env.WHATSAPP_WEBHOOK_URL ||
    `${process.env.NEXTAUTH_URL || "https://isytask-web.vercel.app"}/api/webhooks/whatsapp`;

  // Sort params alphabetically and concatenate
  const sortedParams = Array.from(body.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}${v}`)
    .join("");

  const dataToSign = url + sortedParams;
  const expectedSignature = crypto
    .createHmac("sha1", authToken)
    .update(dataToSign)
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

async function getAuthToken(): Promise<string | null> {
  const config = await db.systemConfig.findUnique({
    where: { key: "twilio_auth_token" },
  });
  return (config?.value as string) || null;
}

// ─── GET: Twilio verification (returns TwiML empty response) ───

export async function GET() {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    {
      headers: { "Content-Type": "text/xml" },
    }
  );
}

// ─── POST: Inbound WhatsApp message ───

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let params: URLSearchParams;
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      params = new URLSearchParams(text);
    } else {
      // Handle JSON (for testing)
      const json = await req.json();
      params = new URLSearchParams(json);
    }

    // Validate Twilio signature in production
    if (process.env.NODE_ENV === "production") {
      const isValid = await validateTwilioSignature(req, params);
      if (!isValid) {
        console.error("[WhatsApp Webhook] Invalid Twilio signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 403 }
        );
      }
    }

    // Extract message fields from Twilio's POST
    const from = params.get("From") || "";
    const body = params.get("Body") || "";
    const messageSid = params.get("MessageSid") || params.get("SmsSid") || "";
    const profileName = params.get("ProfileName") || undefined;

    // Media (images, documents)
    const numMedia = parseInt(params.get("NumMedia") || "0", 10);
    const mediaUrl = numMedia > 0 ? params.get("MediaUrl0") || undefined : undefined;
    const mediaContentType =
      numMedia > 0 ? params.get("MediaContentType0") || undefined : undefined;

    if (!from || !body) {
      console.warn("[WhatsApp Webhook] Missing From or Body");
      return twimlResponse("");
    }

    if (!messageSid) {
      console.warn("[WhatsApp Webhook] Missing MessageSid");
      return twimlResponse("");
    }

    // Check for duplicate messages (Twilio may retry)
    const existing = await db.whatsAppMessage.findUnique({
      where: { twilioSid: messageSid },
    });
    if (existing) {
      console.log(`[WhatsApp Webhook] Duplicate message: ${messageSid}`);
      return twimlResponse("");
    }

    // Process the inbound message asynchronously (fire-and-forget)
    // We respond to Twilio immediately to avoid timeout
    handleInboundWhatsApp({
      db,
      message: {
        from,
        body,
        messageSid,
        mediaUrl,
        mediaContentType,
        profileName,
      },
    }).catch((error) => {
      console.error("[WhatsApp Webhook] Handler error:", error);
    });

    // Return empty TwiML (we send replies via the API, not TwiML)
    return twimlResponse("");
  } catch (error) {
    console.error("[WhatsApp Webhook] Error:", error);
    return twimlResponse("");
  }
}

// ─── TwiML Response Helper ───

function twimlResponse(message: string): NextResponse {
  const twiml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
