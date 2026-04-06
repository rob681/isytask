import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminOrPermissionProcedure, protectedProcedure, router } from "../trpc";
import { PLATFORM_KEYS } from "../lib/platform-config";

const configProcedure = adminOrPermissionProcedure("manage_config");

const DEFAULT_TIME_BLOCKS = [
  { start: "09:00", end: "14:00" },
  { start: "16:00", end: "19:00" },
];

/**
 * Agency-level config defaults.
 * Platform-managed keys (email, AI, WhatsApp Meta) are NO LONGER here.
 */
const CONFIG_DEFAULTS: Record<string, any> = {
  default_monthly_task_limit: 10,
  default_revision_limit_per_task: 3,
  company_name: "Isytask",
  // Notification toggles (agencies can enable/disable channels)
  notification_email_enabled: true,
  notification_whatsapp_enabled: false,
  notification_inapp_enabled: true,
  notification_push_enabled: false,
  // Business hours
  business_hours: {
    monday:    { enabled: true,  blocks: [...DEFAULT_TIME_BLOCKS] },
    tuesday:   { enabled: true,  blocks: [...DEFAULT_TIME_BLOCKS] },
    wednesday: { enabled: true,  blocks: [...DEFAULT_TIME_BLOCKS] },
    thursday:  { enabled: true,  blocks: [...DEFAULT_TIME_BLOCKS] },
    friday:    { enabled: true,  blocks: [...DEFAULT_TIME_BLOCKS] },
    saturday:  { enabled: false, blocks: [] },
    sunday:    { enabled: false, blocks: [] },
  },
  pending_task_reminder_hours: 24,
  // WhatsApp Twilio (agency's own number — optional)
  twilio_account_sid: "",
  twilio_auth_token: "",
  twilio_whatsapp_from: "",
  // Push notifications (VAPID)
  vapid_public_key: "",
  vapid_private_key: "",
  vapid_subject: "mailto:admin@isytask.com",
  // SLA
  sla_alert_threshold_hours: 2,
  // Regional
  timezone: "America/Mexico_City",
  time_format: "24h",
  date_format: "DD/MM/YYYY",
  language: "es",
};

const PUBLIC_KEYS = [
  "company_name",
  "business_hours",
  "timezone",
  "time_format",
  "date_format",
  "language",
];

/** Check if a key is platform-managed (Super Admin only) */
function isPlatformKey(key: string): boolean {
  return (PLATFORM_KEYS as readonly string[]).includes(key);
}

export const configRouter = router({
  // Public config (for sidebar logo, etc.)
  getPublic: protectedProcedure.query(async ({ ctx }) => {
    const configs = await ctx.db.systemConfig.findMany({
      where: { key: { in: PUBLIC_KEYS } },
    });
    const result: Record<string, any> = {};
    for (const key of PUBLIC_KEYS) {
      result[key] = CONFIG_DEFAULTS[key];
    }
    for (const c of configs) {
      result[c.key] = c.value;
    }
    return result;
  }),

  getAll: configProcedure.query(async ({ ctx }) => {
    const configs = await ctx.db.systemConfig.findMany();
    const configMap: Record<string, any> = { ...CONFIG_DEFAULTS };
    for (const c of configs) {
      configMap[c.key] = c.value;
    }
    // Remove platform keys from agency view
    for (const key of PLATFORM_KEYS) {
      delete configMap[key];
    }
    return configMap;
  }),

  get: configProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      if (isPlatformKey(input.key)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Esta configuracion es gestionada por el Super Administrador.",
        });
      }
      const config = await ctx.db.systemConfig.findUnique({
        where: { key: input.key },
      });
      return config?.value ?? CONFIG_DEFAULTS[input.key] ?? null;
    }),

  set: configProcedure
    .input(z.object({ key: z.string(), value: z.any() }))
    .mutation(async ({ ctx, input }) => {
      if (isPlatformKey(input.key)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Esta configuracion es gestionada por el Super Administrador.",
        });
      }
      return ctx.db.systemConfig.upsert({
        where: { key: input.key },
        create: { key: input.key, value: input.value },
        update: { value: input.value },
      });
    }),

  setMany: configProcedure
    .input(z.record(z.string(), z.any()))
    .mutation(async ({ ctx, input }) => {
      // Filter out platform keys
      const safeEntries = Object.entries(input).filter(
        ([key]) => !isPlatformKey(key)
      );

      const operations = safeEntries.map(([key, value]) =>
        ctx.db.systemConfig.upsert({
          where: { key },
          create: { key, value: value as any },
          update: { value: value as any },
        })
      );
      await Promise.all(operations);
      return { success: true };
    }),
});
