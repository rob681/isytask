/**
 * Stripe Setup Script
 * Creates products and prices in Stripe for Isytask + Isysocial ecosystem.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_xxx npx tsx scripts/stripe-setup.ts
 *
 * This script is idempotent — it checks for existing products before creating.
 */

import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error("❌ Set STRIPE_SECRET_KEY environment variable");
  console.error("   Example: STRIPE_SECRET_KEY=sk_test_xxx npx tsx scripts/stripe-setup.ts");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

interface PlanConfig {
  name: string;
  tier: string;
  priceMonthly: number; // in cents
}

interface ProductConfig {
  name: string;
  description: string;
  metadata: { product: string };
  plans: PlanConfig[];
}

const PRODUCTS: ProductConfig[] = [
  {
    name: "Isytask",
    description: "Gestión de tareas para agencias",
    metadata: { product: "ISYTASK" },
    plans: [
      { name: "Básico", tier: "basic", priceMonthly: 2900 },
      { name: "Pro", tier: "pro", priceMonthly: 7900 },
      { name: "Enterprise", tier: "enterprise", priceMonthly: 19900 },
    ],
  },
  {
    name: "Isysocial",
    description: "Gestión de redes sociales para agencias",
    metadata: { product: "ISYSOCIAL" },
    plans: [
      { name: "Básico", tier: "basic", priceMonthly: 2900 },
      { name: "Pro", tier: "pro", priceMonthly: 7900 },
      { name: "Enterprise", tier: "enterprise", priceMonthly: 19900 },
    ],
  },
];

async function main() {
  console.log("🚀 Setting up Stripe products and prices...\n");

  const envLines: string[] = [];

  for (const productConfig of PRODUCTS) {
    // Check if product already exists
    const existing = await stripe.products.search({
      query: `metadata["product"]:"${productConfig.metadata.product}"`,
    });

    let product: Stripe.Product;

    if (existing.data.length > 0) {
      product = existing.data[0];
      console.log(`✅ Product "${productConfig.name}" already exists: ${product.id}`);
    } else {
      product = await stripe.products.create({
        name: productConfig.name,
        description: productConfig.description,
        metadata: productConfig.metadata,
      });
      console.log(`✨ Created product "${productConfig.name}": ${product.id}`);
    }

    // Create prices for each plan
    for (const plan of productConfig.plans) {
      // Check if price already exists
      const existingPrices = await stripe.prices.list({
        product: product.id,
        active: true,
      });

      const existingPrice = existingPrices.data.find(
        (p) => p.metadata?.tier === plan.tier
      );

      let price: Stripe.Price;

      if (existingPrice) {
        price = existingPrice;
        console.log(`  ✅ Price "${plan.name}" already exists: ${price.id}`);
      } else {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.priceMonthly,
          currency: "usd",
          recurring: { interval: "month" },
          metadata: { tier: plan.tier },
          nickname: `${productConfig.name} - ${plan.name}`,
        });
        console.log(`  ✨ Created price "${plan.name}": ${price.id} ($${plan.priceMonthly / 100}/mo)`);
      }

      // Build env var name: STRIPE_PRICE_ISYTASK_BASIC, etc.
      const envKey = `STRIPE_PRICE_${productConfig.metadata.product}_${plan.tier.toUpperCase()}`;
      envLines.push(`${envKey}="${price.id}"`);
    }

    console.log("");
  }

  // Create cross-product discount coupon
  const couponId = "cross_product_10pct";
  try {
    await stripe.coupons.retrieve(couponId);
    console.log(`✅ Coupon "${couponId}" already exists`);
  } catch {
    await stripe.coupons.create({
      id: couponId,
      percent_off: 10,
      duration: "forever",
      name: "Descuento multi-producto (10%)",
    });
    console.log(`✨ Created coupon "${couponId}" (10% off forever)`);
  }

  // Configure customer portal
  try {
    const configs = await stripe.billingPortal.configurations.list({ limit: 1 });
    if (configs.data.length === 0) {
      await stripe.billingPortal.configurations.create({
        business_profile: {
          headline: "Gestiona tu suscripción",
        },
        features: {
          subscription_cancel: { enabled: true },
          subscription_update: {
            enabled: true,
            default_allowed_updates: ["price"],
          },
          payment_method_update: { enabled: true },
          invoice_history: { enabled: true },
        },
      });
      console.log(`✨ Created billing portal configuration`);
    } else {
      console.log(`✅ Billing portal already configured`);
    }
  } catch (err) {
    console.warn(`⚠️  Could not configure billing portal:`, (err as Error).message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("📋 Add these to your .env file:\n");
  console.log(envLines.join("\n"));
  console.log("\n" + "=".repeat(60));
  console.log("\n✅ Stripe setup complete!");
}

main().catch((err) => {
  console.error("❌ Setup failed:", err.message);
  process.exit(1);
});
