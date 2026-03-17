import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@isytask/db";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

/**
 * When a checkout session completes, create/update the subscription in our DB.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { agencyId, product, planTier } = session.metadata ?? {};

  if (!agencyId || !product || !planTier) {
    console.error("[Stripe Webhook] Missing metadata in checkout session:", session.id);
    return;
  }

  const stripeSubscriptionId = session.subscription as string;

  // Upsert the subscription (handles race conditions from React StrictMode etc.)
  await db.subscription.upsert({
    where: {
      agencyId_product: {
        agencyId,
        product: product as "ISYTASK" | "ISYSOCIAL",
      },
    },
    create: {
      agencyId,
      product: product as "ISYTASK" | "ISYSOCIAL",
      planTier,
      stripeSubscriptionId,
      status: "active",
      currentPeriodStart: new Date(),
    },
    update: {
      planTier,
      stripeSubscriptionId,
      status: "active",
      canceledAt: null,
      currentPeriodStart: new Date(),
    },
  });

  console.log(`[Stripe Webhook] Subscription created: ${product} ${planTier} for agency ${agencyId}`);
}

/**
 * When a subscription is updated (plan change, renewal, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const { agencyId, product, planTier } = subscription.metadata ?? {};

  if (!agencyId || !product) {
    console.warn("[Stripe Webhook] Subscription updated without metadata:", subscription.id);
    return;
  }

  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    trialing: "trial",
    unpaid: "past_due",
    incomplete: "past_due",
    incomplete_expired: "canceled",
    paused: "canceled",
  };

  const mappedStatus = statusMap[subscription.status] || "active";

  // In Stripe SDK v20 (clover API), period dates are on subscription items
  const firstItem = subscription.items?.data?.[0];
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000)
    : new Date();
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000)
    : null;

  await db.subscription.upsert({
    where: {
      agencyId_product: {
        agencyId,
        product: product as "ISYTASK" | "ISYSOCIAL",
      },
    },
    create: {
      agencyId,
      product: product as "ISYTASK" | "ISYSOCIAL",
      planTier: planTier || "basic",
      stripeSubscriptionId: subscription.id,
      status: mappedStatus,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
    },
    update: {
      status: mappedStatus,
      planTier: planTier || undefined,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
    },
  });

  console.log(`[Stripe Webhook] Subscription updated: ${subscription.id} → ${mappedStatus}`);
}

/**
 * When a subscription is deleted/canceled.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { agencyId, product } = subscription.metadata ?? {};

  if (!agencyId || !product) {
    console.warn("[Stripe Webhook] Subscription deleted without metadata:", subscription.id);
    return;
  }

  await db.subscription.updateMany({
    where: {
      agencyId,
      product: product as "ISYTASK" | "ISYSOCIAL",
    },
    data: {
      status: "canceled",
      canceledAt: new Date(),
    },
  });

  console.log(`[Stripe Webhook] Subscription canceled: ${product} for agency ${agencyId}`);
}

/**
 * When a payment fails.
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // In Stripe v20, subscription is accessed via parent.subscription_details.subscription
  const subDetails = invoice.parent?.subscription_details;
  const subscriptionId =
    typeof subDetails?.subscription === "string"
      ? subDetails.subscription
      : subDetails?.subscription?.id;

  if (!subscriptionId) return;

  // Update subscription status to past_due
  await db.subscription.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: { status: "past_due" },
  });

  console.log(`[Stripe Webhook] Payment failed for subscription: ${subscriptionId}`);
}
