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

  /** Test Resend email configuration */
  testResendEmail: superAdminProcedure
    .input(z.object({ testEmail: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get Resend configuration
        const apiKey = await (ctx.db as any).platformConfig.findUnique({
          where: { key: "resend_api_key" },
        });
        const fromAddress = await (ctx.db as any).platformConfig.findUnique({
          where: { key: "email_from_address" },
        });
        const fromName = await (ctx.db as any).platformConfig.findUnique({
          where: { key: "email_from_name" },
        });

        if (!apiKey?.value) {
          return { success: false, error: "No Resend API key configured" };
        }

        if (!fromAddress?.value) {
          return { success: false, error: "No email_from_address configured" };
        }

        // Dynamic import of Resend
        const { Resend } = await import("resend");
        const resend = new Resend(apiKey.value);

        // Send test email
        const result = await resend.emails.send({
          from: `${fromName?.value || "Isytask"} <${fromAddress.value}>`,
          to: input.testEmail,
          subject: "Test email from Isytask",
          html: `
            <h1>Resend Email Test</h1>
            <p>If you received this email, your Resend configuration is working correctly.</p>
            <p><strong>From:</strong> ${fromAddress.value}</p>
            <p><strong>API Key (first 20 chars):</strong> ${apiKey.value.substring(0, 20)}...</p>
          `,
        });

        if (result.error) {
          console.error("[Resend Test] Email send failed:", result.error);
          return {
            success: false,
            error: result.error.message || JSON.stringify(result.error)
          };
        }

        return {
          success: true,
          message: "Test email sent successfully",
          emailId: result.data?.id
        };
      } catch (error) {
        console.error("[Resend Test] Error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }),
});
