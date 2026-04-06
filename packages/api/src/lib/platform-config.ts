import type { PrismaClient } from "@isytask/db";

/**
 * Get a platform-wide config value (managed by SUPER_ADMIN).
 * Falls back to defaultValue if not found.
 */
export async function getPlatformConfig(
  db: PrismaClient,
  key: string,
  defaultValue: any = null
) {
  const config = await (db as any).platformConfig.findUnique({
    where: { key },
  });
  return config?.value ?? defaultValue;
}

/**
 * Set a platform-wide config value (SUPER_ADMIN only).
 */
export async function setPlatformConfig(
  db: PrismaClient,
  key: string,
  value: any
) {
  return (db as any).platformConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/**
 * Get config with fallback chain:
 * 1. PlatformConfig (global) — for platform-managed keys
 * 2. SystemConfig (per-agency) — for agency-specific keys
 * 3. defaultValue
 */
export async function getConfigWithFallback(
  db: PrismaClient,
  key: string,
  defaultValue: any = null
) {
  // Check platform config first
  const platformConfig = await (db as any).platformConfig.findUnique({
    where: { key },
  });
  if (platformConfig?.value != null) return platformConfig.value;

  // Fall back to agency-level system config
  const systemConfig = await db.systemConfig.findUnique({
    where: { key },
  });
  return systemConfig?.value ?? defaultValue;
}

// Keys that are now managed at platform level (SUPER_ADMIN only)
export const PLATFORM_KEYS = [
  // Email (Resend)
  "resend_api_key",
  "email_from_address",
  "email_from_name",
  // AI (OpenRouter)
  "openrouter_api_key",
  "ai_agent_default_model",
  "ai_agent_enabled",
  // WhatsApp Platform (Meta Business API)
  "meta_whatsapp_phone_number_id",
  "meta_whatsapp_access_token",
  "meta_whatsapp_business_id",
  "meta_whatsapp_verify_token",
  "platform_whatsapp_from",
] as const;
