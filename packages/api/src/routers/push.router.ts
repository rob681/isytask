import { z } from "zod";
import { protectedProcedure, adminOrPermissionProcedure, router } from "../trpc";

const configProcedure = adminOrPermissionProcedure("manage_config");

export const pushRouter = router({
  // Get VAPID public key (for client-side subscription)
  getPublicKey: protectedProcedure.query(async ({ ctx }) => {
    const config = await ctx.db.systemConfig.findUnique({
      where: { key: "vapid_public_key" },
    });
    return (config?.value as string) ?? "";
  }),

  // Subscribe to push notifications
  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        p256dh: z.string(),
        auth: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Upsert — if endpoint already exists, update keys
      return ctx.db.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: {
          userId: ctx.session.user.id,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
        },
        update: {
          p256dh: input.p256dh,
          auth: input.auth,
        },
      });
    }),

  // Unsubscribe from push notifications
  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.pushSubscription.deleteMany({
        where: {
          userId: ctx.session.user.id,
          endpoint: input.endpoint,
        },
      });
      return { success: true };
    }),

  // Check if user has active subscription
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.pushSubscription.count({
      where: { userId: ctx.session.user.id },
    });
    return { subscribed: count > 0, count };
  }),

  // ── Expo Push Token (Mobile) ─────────────────────────────────

  /** Register an Expo Push Token from the mobile app */
  registerExpoPushToken: protectedProcedure
    .input(
      z.object({
        token: z.string().min(1),
        platform: z.enum(["ios", "android"]).default("ios"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.expoPushToken.upsert({
        where: { token: input.token },
        create: {
          userId: ctx.session.user.id,
          token: input.token,
          platform: input.platform,
          isActive: true,
        },
        update: {
          userId: ctx.session.user.id,
          platform: input.platform,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    }),

  /** Unregister an Expo Push Token (logout) */
  unregisterExpoPushToken: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.expoPushToken.updateMany({
        where: { token: input.token, userId: ctx.session.user.id },
        data: { isActive: false },
      });
      return { success: true };
    }),

  // Admin: generate VAPID keys
  generateVapidKeys: configProcedure.mutation(async ({ ctx }) => {
    const webpush = await import("web-push");
    const vapidKeys = webpush.generateVAPIDKeys();

    await Promise.all([
      ctx.db.systemConfig.upsert({
        where: { key: "vapid_public_key" },
        create: { key: "vapid_public_key", value: vapidKeys.publicKey as any },
        update: { value: vapidKeys.publicKey as any },
      }),
      ctx.db.systemConfig.upsert({
        where: { key: "vapid_private_key" },
        create: { key: "vapid_private_key", value: vapidKeys.privateKey as any },
        update: { value: vapidKeys.privateKey as any },
      }),
    ]);

    return { publicKey: vapidKeys.publicKey };
  }),
});
