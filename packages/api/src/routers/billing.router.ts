import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure, getAgencyId } from "../trpc";
import { getStripe, STRIPE_PRICES } from "../lib/stripe";
import { CROSS_PRODUCT_DISCOUNT } from "@isytask/shared";

export const billingRouter = router({
  /**
   * Create a Stripe Checkout Session for subscribing to a product/plan.
   * Redirects the user to Stripe's hosted checkout page.
   */
  createCheckoutSession: adminProcedure
    .input(
      z.object({
        product: z.enum(["ISYTASK", "ISYSOCIAL"]),
        planTier: z.enum(["basic", "pro", "enterprise"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const agencyId = getAgencyId(ctx);

      // Get or create Stripe customer for this agency
      const agency = await ctx.db.agency.findUniqueOrThrow({
        where: { id: agencyId },
        select: { id: true, name: true, stripeCustomerId: true },
      });

      let stripeCustomerId = agency.stripeCustomerId;

      if (!stripeCustomerId) {
        // Get admin email for Stripe customer
        const admin = await ctx.db.user.findFirst({
          where: { agencyId, role: "ADMIN" },
          select: { email: true, name: true },
        });

        const customer = await stripe.customers.create({
          email: admin?.email || undefined,
          name: agency.name,
          metadata: { agencyId },
        });

        stripeCustomerId = customer.id;

        await ctx.db.agency.update({
          where: { id: agencyId },
          data: { stripeCustomerId },
        });
      }

      // Check if there's already an active subscription for this product
      const existingSub = await ctx.db.subscription.findUnique({
        where: { agencyId_product: { agencyId, product: input.product } },
      });

      if (existingSub && ["active", "trial"].includes(existingSub.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Ya tienes una suscripción activa para ${input.product}. Usa el portal para cambiar de plan.`,
        });
      }

      // Get the Stripe price ID
      const priceId = STRIPE_PRICES[input.product]?.[input.planTier];
      if (!priceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Precio no configurado para ${input.product} ${input.planTier}. Contacta soporte.`,
        });
      }

      // Check if agency already has another product (for cross-product discount)
      const otherSubs = await ctx.db.subscription.findMany({
        where: {
          agencyId,
          product: { not: input.product },
          status: { in: ["active", "trial"] },
        },
      });

      const discounts: { coupon?: string }[] = [];
      // If agency has another active product, apply cross-product discount
      if (otherSubs.length > 0 && CROSS_PRODUCT_DISCOUNT > 0) {
        // We'll create/find a coupon for the discount
        const couponId = `cross_product_${CROSS_PRODUCT_DISCOUNT}pct`;
        try {
          await stripe.coupons.retrieve(couponId);
        } catch {
          // Coupon doesn't exist, create it
          await stripe.coupons.create({
            id: couponId,
            percent_off: CROSS_PRODUCT_DISCOUNT,
            duration: "forever",
            name: `Descuento multi-producto (${CROSS_PRODUCT_DISCOUNT}%)`,
          });
        }
        discounts.push({ coupon: couponId });
      }

      // Determine URLs
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        discounts: discounts.length > 0 ? discounts : undefined,
        success_url: `${baseUrl}/admin/billing?success=true&product=${input.product}`,
        cancel_url: `${baseUrl}/admin/billing?canceled=true`,
        subscription_data: {
          metadata: {
            agencyId,
            product: input.product,
            planTier: input.planTier,
          },
        },
        metadata: {
          agencyId,
          product: input.product,
          planTier: input.planTier,
        },
      });

      return { url: session.url };
    }),

  /**
   * Create a Stripe Customer Portal session.
   * Allows the customer to manage subscriptions, update payment methods, etc.
   */
  createPortalSession: adminProcedure.mutation(async ({ ctx }) => {
    const stripe = getStripe();
    const agencyId = getAgencyId(ctx);

    const agency = await ctx.db.agency.findUniqueOrThrow({
      where: { id: agencyId },
      select: { stripeCustomerId: true },
    });

    if (!agency.stripeCustomerId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No tienes una cuenta de facturación configurada.",
      });
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: agency.stripeCustomerId,
      return_url: `${baseUrl}/admin/billing`,
    });

    return { url: session.url };
  }),

  /**
   * Get billing overview for the current agency.
   */
  getBillingOverview: adminProcedure.query(async ({ ctx }) => {
    const agencyId = getAgencyId(ctx);

    const [agency, subscriptions] = await Promise.all([
      ctx.db.agency.findUniqueOrThrow({
        where: { id: agencyId },
        select: { name: true, stripeCustomerId: true },
      }),
      ctx.db.subscription.findMany({
        where: { agencyId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    return {
      hasStripeCustomer: !!agency.stripeCustomerId,
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        product: s.product,
        planTier: s.planTier,
        status: s.status,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        trialEndsAt: s.trialEndsAt,
        canceledAt: s.canceledAt,
        stripeSubscriptionId: s.stripeSubscriptionId,
      })),
    };
  }),

  /**
   * Get available plans and pricing for upgrade page.
   */
  getPlans: protectedProcedure.query(async ({ ctx }) => {
    const agencyId = getAgencyId(ctx);

    const currentSubs = await ctx.db.subscription.findMany({
      where: { agencyId, status: { in: ["active", "trial"] } },
      select: { product: true, planTier: true },
    });

    const hasMultipleProducts = currentSubs.length > 1;

    return {
      currentSubscriptions: currentSubs,
      hasMultipleProducts,
      crossProductDiscount: CROSS_PRODUCT_DISCOUNT,
      plans: [
        {
          tier: "basic",
          name: "Básico",
          price: 29,
          features: [
            "Hasta 5 colaboradores",
            "Hasta 20 clientes",
            "Tareas ilimitadas",
            "Soporte por email",
          ],
        },
        {
          tier: "pro",
          name: "Pro",
          price: 79,
          popular: true,
          features: [
            "Hasta 15 colaboradores",
            "Hasta 100 clientes",
            "Tareas ilimitadas",
            "Campos dinámicos avanzados",
            "Reportes de rentabilidad",
            "Soporte prioritario",
          ],
        },
        {
          tier: "enterprise",
          name: "Enterprise",
          price: null,
          features: [
            "Colaboradores ilimitados",
            "Clientes ilimitados",
            "Tareas ilimitadas",
            "API personalizada",
            "Soporte dedicado 24/7",
            "Onboarding personalizado",
          ],
        },
      ],
    };
  }),
});
