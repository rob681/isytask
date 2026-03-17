import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️  STRIPE_SECRET_KEY not set — Stripe features will be unavailable");
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : (null as unknown as Stripe);

/** Ensure stripe is initialized before use */
export function getStripe(): Stripe {
  if (!stripe) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in .env");
  }
  return stripe;
}

// ── Stripe Price IDs (set after creating products in Stripe) ──
// These map to your Stripe products & prices.
// Update after running the seed script or creating products manually.

export const STRIPE_PRICES = {
  ISYTASK: {
    basic: process.env.STRIPE_PRICE_ISYTASK_BASIC || "",
    pro: process.env.STRIPE_PRICE_ISYTASK_PRO || "",
    enterprise: process.env.STRIPE_PRICE_ISYTASK_ENTERPRISE || "",
  },
  ISYSOCIAL: {
    basic: process.env.STRIPE_PRICE_ISYSOCIAL_BASIC || "",
    pro: process.env.STRIPE_PRICE_ISYSOCIAL_PRO || "",
    enterprise: process.env.STRIPE_PRICE_ISYSOCIAL_ENTERPRISE || "",
  },
} as const;
