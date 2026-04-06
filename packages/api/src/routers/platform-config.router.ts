import { z } from "zod";
import { superAdminProcedure, router } from "../trpc";
import { PLATFORM_KEYS } from "../lib/platform-config";

/**
 * Platform Configuration Router — SUPER_ADMIN only.
 *
 * Manages global settings for:
 * - Email (Resend): API key, from address, from name
 * - AI (OpenRouter): API key, default model, enabled toggle
 * - WhatsApp Platform (Meta Business API): phone ID, access token
 */
export const platformConfigRouter = router({
  /** Get all platform config values */
  getAll: superAdminProcedure.query(async ({ ctx }) => {
    const configs = await (ctx.db as any).platformConfig.findMany();
    const result: Record<string, any> = {};
    for (const c of configs) {
      result[c.key] = c.value;
    }
    return result;
  }),

  /** Get a single platform config value */
  get: superAdminProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const config = await (ctx.db as any).platformConfig.findUnique({
        where: { key: input.key },
      });
      return config?.value ?? null;
    }),

  /** Set multiple platform config values at once */
  setMany: superAdminProcedure
    .input(z.record(z.string(), z.any()))
    .mutation(async ({ ctx, input }) => {
      const updates = Object.entries(input).map(([key, value]) =>
        (ctx.db as any).platformConfig.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        })
      );
      await Promise.all(updates);
      return { success: true, count: updates.length };
    }),

  /** Migrate existing SystemConfig keys to PlatformConfig (one-time) */
  migrateFromSystemConfig: superAdminProcedure.mutation(async ({ ctx }) => {
    let migrated = 0;

    for (const key of PLATFORM_KEYS) {
      // Check if already in PlatformConfig
      const existing = await (ctx.db as any).platformConfig.findUnique({
        where: { key },
      });
      if (existing) continue;

      // Read from SystemConfig
      const systemConfig = await ctx.db.systemConfig.findUnique({
        where: { key },
      });
      if (!systemConfig) continue;

      // Copy to PlatformConfig
      await (ctx.db as any).platformConfig.create({
        data: { key, value: systemConfig.value },
      });
      migrated++;
    }

    return { success: true, migrated };
  }),
});
