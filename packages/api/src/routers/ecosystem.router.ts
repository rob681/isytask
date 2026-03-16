import { z } from "zod";
import { router, protectedProcedure, getAgencyId } from "../trpc";

export const ecosystemRouter = router({
  /** Get all subscriptions for the current agency */
  getAgencySubscriptions: protectedProcedure.query(async ({ ctx }) => {
    const agencyId = getAgencyId(ctx);
    return ctx.db.subscription.findMany({
      where: { agencyId },
      select: {
        id: true,
        product: true,
        planTier: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        trialEndsAt: true,
        stripeSubscriptionId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  /** Validate if the agency has access to a specific product */
  validateProductAccess: protectedProcedure
    .input(z.enum(["ISYTASK", "ISYSOCIAL"]))
    .query(async ({ ctx, input: product }) => {
      const agencyId = getAgencyId(ctx);
      const sub = await ctx.db.subscription.findUnique({
        where: { agencyId_product: { agencyId, product } },
      });
      return {
        hasAccess: !!sub && ["active", "trial"].includes(sub.status),
        subscription: sub,
      };
    }),

  /** Get product selector data for navigation */
  getProductSelector: protectedProcedure.query(async ({ ctx }) => {
    const agencyId = getAgencyId(ctx);
    const subs = await ctx.db.subscription.findMany({
      where: { agencyId },
      select: { product: true, planTier: true, status: true },
    });
    return {
      availableProducts: subs
        .filter((s) => ["active", "trial"].includes(s.status))
        .map((s) => ({ product: s.product, planTier: s.planTier })),
    };
  }),

  /** Get cross-product discount info */
  getCrossProductDiscount: protectedProcedure.query(async ({ ctx }) => {
    const agencyId = getAgencyId(ctx);
    const [subs, discount] = await Promise.all([
      ctx.db.subscription.findMany({
        where: { agencyId, status: { in: ["active", "trial"] } },
        select: { product: true },
      }),
      ctx.db.crossProductDiscount.findFirst({
        where: { isActive: true },
      }),
    ]);

    const activeProducts = subs.map((s) => s.product);
    const hasBothProducts =
      activeProducts.includes("ISYTASK") && activeProducts.includes("ISYSOCIAL");

    return {
      activeProducts,
      hasBothProducts,
      discountPercent: hasBothProducts && discount ? discount.discountPercent : 0,
    };
  }),
});
