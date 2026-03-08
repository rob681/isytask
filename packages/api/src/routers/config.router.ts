import { z } from "zod";
import { adminOrPermissionProcedure, protectedProcedure, router } from "../trpc";

const configProcedure = adminOrPermissionProcedure("manage_config");

const DEFAULT_TIME_BLOCKS = [
  { start: "09:00", end: "14:00" },
  { start: "16:00", end: "19:00" },
];

const CONFIG_DEFAULTS: Record<string, any> = {
  default_monthly_task_limit: 10,
  default_revision_limit_per_task: 3,
  company_name: "Isytask",
  company_logo_url: null,
  company_logo_white_url: null,
  notification_email_enabled: true,
  notification_whatsapp_enabled: false,
  notification_inapp_enabled: true,
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
  // Email config (Resend)
  resend_api_key: "",
  email_from_address: "noreply@isytask.com",
  email_from_name: "Isytask",
  // Push notifications
  vapid_public_key: "",
  vapid_private_key: "",
  vapid_subject: "mailto:admin@isytask.com",
  notification_push_enabled: false,
  timezone: "America/Mexico_City",
  time_format: "24h",
  date_format: "DD/MM/YYYY",
  language: "es",
};

const PUBLIC_KEYS = [
  "company_name",
  "company_logo_url",
  "company_logo_white_url",
  "business_hours",
  "timezone",
  "time_format",
  "date_format",
  "language",
];

export const configRouter = router({
  // Public config (for sidebar logo, etc.) - only requires authentication, not admin
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
    return configMap;
  }),

  get: configProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const config = await ctx.db.systemConfig.findUnique({
        where: { key: input.key },
      });
      return config?.value ?? CONFIG_DEFAULTS[input.key] ?? null;
    }),

  set: configProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.systemConfig.upsert({
        where: { key: input.key },
        create: { key: input.key, value: input.value },
        update: { value: input.value },
      });
    }),

  setMany: configProcedure
    .input(z.record(z.string(), z.any()))
    .mutation(async ({ ctx, input }) => {
      const operations = Object.entries(input).map(([key, value]) =>
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
