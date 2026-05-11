import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure, getAgencyId } from "../trpc";

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
    .input(z.enum(["ISYTASK", "ISYSOCIAL", "ISYWEB"]))
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

  /** Get Isysocial stats for cross-product dashboard card */
  getIsysocialStats: protectedProcedure.query(async ({ ctx }) => {
    const agencyId = getAgencyId(ctx);

    // Check if agency has Isysocial subscription
    const sub = await ctx.db.subscription.findUnique({
      where: { agencyId_product: { agencyId, product: "ISYSOCIAL" } },
    });

    if (!sub || !["active", "trial"].includes(sub.status)) {
      return { hasAccess: false as const };
    }

    // Cross-schema query to get Isysocial post stats
    try {
      const stats = await ctx.db.$queryRawUnsafe<
        Array<{ status: string; count: bigint }>
      >(
        `SELECT status, COUNT(*)::bigint as count
         FROM isysocial."Post"
         WHERE "agencyId" = (
           SELECT id FROM isysocial."Agency"
           WHERE "name" = (SELECT name FROM public."Agency" WHERE id = $1)
           LIMIT 1
         )
         GROUP BY status`,
        agencyId
      );

      const ideaStats = await ctx.db.$queryRawUnsafe<
        Array<{ status: string; count: bigint }>
      >(
        `SELECT status, COUNT(*)::bigint as count
         FROM isysocial."Idea"
         WHERE "agencyId" = (
           SELECT id FROM isysocial."Agency"
           WHERE "name" = (SELECT name FROM public."Agency" WHERE id = $1)
           LIMIT 1
         )
         GROUP BY status`,
        agencyId
      );

      const postCounts: Record<string, number> = {};
      for (const row of stats) {
        postCounts[row.status] = Number(row.count);
      }

      const ideaCounts: Record<string, number> = {};
      for (const row of ideaStats) {
        ideaCounts[row.status] = Number(row.count);
      }

      return {
        hasAccess: true as const,
        posts: {
          published: postCounts["PUBLISHED"] ?? 0,
          scheduled: postCounts["SCHEDULED"] ?? 0,
          inReview: postCounts["IN_REVIEW"] ?? 0,
          draft: postCounts["DRAFT"] ?? 0,
          total: Object.values(postCounts).reduce((a, b) => a + b, 0),
        },
        ideas: {
          ready: ideaCounts["READY"] ?? 0,
          inProgress: ideaCounts["IN_PROGRESS"] ?? 0,
          backlog: ideaCounts["BACKLOG"] ?? 0,
          total: Object.values(ideaCounts).reduce((a, b) => a + b, 0),
        },
      };
    } catch (error) {
      // Isysocial schema might not exist yet or tables are empty
      console.error("[Ecosystem] Cross-schema query failed:", error);
      return {
        hasAccess: true as const,
        posts: { published: 0, scheduled: 0, inReview: 0, draft: 0, total: 0 },
        ideas: { ready: 0, inProgress: 0, backlog: 0, total: 0 },
      };
    }
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

  // ──────────────────────────────────────────────
  // ISYWEB addon — agency-level activation (Level 1 gating)
  // ──────────────────────────────────────────────

  /**
   * Returns a single object with booleans for which products this user
   * actually has access to, taking into account agency subscription AND
   * (for clientes) per-client toggles. Used by sidebar + page-level gates.
   */
  getMyAccess: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role as string;
    const userId = ctx.session.user.id;
    const agencyId = ctx.session.user.agencyId as string | undefined;

    // SUPER_ADMIN / platform staff see everything
    if (["SUPER_ADMIN", "SOPORTE", "FACTURACION", "VENTAS", "ANALISTA"].includes(role)) {
      return { isytask: true, isysocial: true, isyweb: true, isClienteWithIsyweb: false };
    }

    if (!agencyId) {
      return { isytask: false, isysocial: false, isyweb: false, isClienteWithIsyweb: false };
    }

    const subs = await ctx.db.subscription.findMany({
      where: { agencyId, status: { in: ["active", "trial"] } },
      select: { product: true },
    });
    const products = new Set(subs.map((s) => s.product));

    // Cliente-level Isyweb check
    let clienteIsyweb = false;
    if (role === "CLIENTE" && products.has("ISYWEB")) {
      const profile = await ctx.db.clientProfile.findUnique({
        where: { userId },
        select: { isywebEnabled: true },
      });
      clienteIsyweb = !!profile?.isywebEnabled;
    }

    return {
      isytask: products.has("ISYTASK"),
      isysocial: products.has("ISYSOCIAL"),
      // For non-clientes: agency subscription is enough. For clientes: also need flag.
      isyweb:
        products.has("ISYWEB") &&
        (role !== "CLIENTE" || clienteIsyweb),
      isClienteWithIsyweb: clienteIsyweb,
    };
  }),

  /**
   * Admin activates Isyweb as a 14-day trial. Idempotent — if already
   * exists, reactivates the trial.
   */
  activateIsyweb: adminProcedure.mutation(async ({ ctx }) => {
    const agencyId = getAgencyId(ctx);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return ctx.db.subscription.upsert({
      where: { agencyId_product: { agencyId, product: "ISYWEB" } },
      create: {
        agencyId,
        product: "ISYWEB",
        planTier: "trial",
        status: "trial",
        trialEndsAt,
      },
      update: { status: "trial", trialEndsAt, canceledAt: null },
    });
  }),

  /** Admin cancels Isyweb subscription. Sub stays but status=canceled. */
  deactivateIsyweb: adminProcedure.mutation(async ({ ctx }) => {
    const agencyId = getAgencyId(ctx);
    const existing = await ctx.db.subscription.findUnique({
      where: { agencyId_product: { agencyId, product: "ISYWEB" } },
    });
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Isyweb no está activo en esta agencia",
      });
    }
    return ctx.db.subscription.update({
      where: { agencyId_product: { agencyId, product: "ISYWEB" } },
      data: { status: "canceled", canceledAt: new Date() },
    });
  }),
});
