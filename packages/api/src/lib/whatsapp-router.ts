/**
 * WhatsApp Hybrid Router
 *
 * Intelligent routing between Twilio and WhatsApp Business API.
 * Tries primary provider, falls back to secondary if enabled and primary fails.
 */

import type { PrismaClient } from "@isytask/db";
import { sendWhatsAppMessage } from "./whatsapp";
import { sendWhatsAppBusinessMessage } from "./whatsapp-business";

export type WhatsAppProvider = "twilio" | "meta" | "auto";

interface SendWhatsAppParams {
  db: PrismaClient;
  to: string;
  body: string;
  mediaUrl?: string;
  mediaType?: "image" | "document" | "video" | "audio";
  provider?: WhatsAppProvider; // If not specified, use auto-detection
}

/**
 * Send WhatsApp message using hybrid provider logic
 *
 * Provider priority:
 * - If provider="auto" (default): Try primary, fallback to secondary
 * - If provider="twilio": Only use Twilio
 * - If provider="meta": Only use Meta
 */
export async function sendWhatsAppMessageHybrid({
  db,
  to,
  body,
  mediaUrl,
  mediaType,
  provider = "auto",
}: SendWhatsAppParams): Promise<{
  success: boolean;
  provider: string;
  error?: string;
}> {
  try {
    // Get provider preferences from config
    const [twilioEnabled, metaEnabled, twilioPreference] = await Promise.all([
      getConfigValue(db, "notification_whatsapp_enabled"),
      getConfigValue(db, "notification_whatsapp_business_enabled"),
      getConfigValue(db, "whatsapp_primary_provider"),
    ]);

    const primaryProvider =
      (twilioPreference as string) || "twilio"; // Default to Twilio for backward compatibility
    const secondaryProvider = primaryProvider === "twilio" ? "meta" : "twilio";

    // Determine which providers to try
    let providersToTry: string[] = [];

    if (provider === "auto") {
      if (primaryProvider === "twilio" && twilioEnabled) {
        providersToTry.push("twilio");
        if (metaEnabled) providersToTry.push("meta");
      } else if (primaryProvider === "meta" && metaEnabled) {
        providersToTry.push("meta");
        if (twilioEnabled) providersToTry.push("twilio");
      } else if (twilioEnabled) {
        providersToTry.push("twilio");
        if (metaEnabled) providersToTry.push("meta");
      } else if (metaEnabled) {
        providersToTry.push("meta");
      }
    } else {
      providersToTry.push(provider);
    }

    if (providersToTry.length === 0) {
      return {
        success: false,
        provider: "none",
        error: "No WhatsApp provider enabled",
      };
    }

    // Try each provider in order
    let lastError: string | undefined;

    for (const prov of providersToTry) {
      try {
        if (prov === "twilio") {
          const success = await sendWhatsAppMessage({
            db,
            to,
            body,
          });

          if (success) {
            return { success: true, provider: "twilio" };
          }
        } else if (prov === "meta") {
          const success = await sendWhatsAppBusinessMessage({
            db,
            to,
            body,
            mediaUrl,
            mediaType,
          });

          if (success) {
            return { success: true, provider: "meta" };
          }
        }
      } catch (error) {
        lastError = String(error);
        console.warn(`[WhatsApp Router] ${prov} failed, trying next provider`, error);
        continue;
      }
    }

    return {
      success: false,
      provider: "none",
      error:
        lastError ||
        "All WhatsApp providers failed or are not configured properly",
    };
  } catch (error) {
    return {
      success: false,
      provider: "error",
      error: String(error),
    };
  }
}

/**
 * Helper to get config value safely
 */
async function getConfigValue(
  db: PrismaClient,
  key: string
): Promise<any> {
  try {
    const config = await db.systemConfig.findUnique({
      where: { key },
    });
    return config?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Get provider status for dashboard/admin
 */
export async function getWhatsAppProviderStatus(db: PrismaClient) {
  const [twilioEnabled, metaEnabled, primaryProvider] = await Promise.all([
    getConfigValue(db, "notification_whatsapp_enabled"),
    getConfigValue(db, "notification_whatsapp_business_enabled"),
    getConfigValue(db, "whatsapp_primary_provider"),
  ]);

  const [twilioConfigured, metaConfigured] = await Promise.all([
    hasTwilioConfig(db),
    hasMetaConfig(db),
  ]);

  return {
    twilio: {
      enabled: twilioEnabled === true,
      configured: twilioConfigured,
      isPrimary: primaryProvider !== "meta",
    },
    meta: {
      enabled: metaEnabled === true,
      configured: metaConfigured,
      isPrimary: primaryProvider === "meta",
    },
  };
}

/**
 * Check if Twilio is fully configured
 */
async function hasTwilioConfig(db: PrismaClient): Promise<boolean> {
  const [sid, token, from] = await Promise.all([
    getConfigValue(db, "twilio_account_sid"),
    getConfigValue(db, "twilio_auth_token"),
    getConfigValue(db, "twilio_whatsapp_from"),
  ]);

  return !!(sid && token && from);
}

/**
 * Check if Meta is fully configured
 */
async function hasMetaConfig(db: PrismaClient): Promise<boolean> {
  const [phoneId, token] = await Promise.all([
    getConfigValue(db, "meta_whatsapp_phone_number_id"),
    getConfigValue(db, "meta_whatsapp_access_token"),
  ]);

  return !!(phoneId && token);
}
