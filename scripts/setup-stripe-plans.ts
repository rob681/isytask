/**
 * Script: setup-stripe-plans.ts
 * Actualiza los productos y precios en Stripe con la estructura de planes de Isytask.
 *
 * Uso: npx ts-node scripts/setup-stripe-plans.ts
 * O:   pnpm exec ts-node scripts/setup-stripe-plans.ts
 */

import Stripe from "stripe";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env from apps/web
dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ── Plan definitions ──────────────────────────────────────────────
const ISYTASK_PLANS = [
  {
    key: "basic",
    envKey: "STRIPE_PRICE_ISYTASK_BASIC",
    name: "Isytask Starter",
    description: "Para agencias pequeñas y freelancers",
    price: 2900, // cents
    features: [
      "Hasta 3 usuarios internos",
      "Colaboradores externos ilimitados",
      "Hasta 50 tareas/mes",
      "Formularios dinámicos",
      "1 integración WhatsApp",
      "IA categorización básica",
      "Soporte por email",
    ],
    metadata: {
      tier: "basic",
      product: "ISYTASK",
      max_internal_users: "3",
      max_tasks_per_month: "50",
      whatsapp_integrations: "1",
    },
  },
  {
    key: "pro",
    envKey: "STRIPE_PRICE_ISYTASK_PRO",
    name: "Isytask Profesional",
    description: "Para agencias en crecimiento",
    price: 7900, // cents
    features: [
      "Hasta 10 usuarios internos",
      "Colaboradores externos ilimitados",
      "Tareas ilimitadas",
      "Formularios dinámicos con lógica avanzada",
      "5 integraciones WhatsApp",
      "IA completa (categorización + sugerencias + chat)",
      "Analytics & reportes",
      "Predicción de riesgos",
      "Soporte por email + Slack",
    ],
    metadata: {
      tier: "pro",
      product: "ISYTASK",
      max_internal_users: "10",
      max_tasks_per_month: "unlimited",
      whatsapp_integrations: "5",
      ai_features: "full",
    },
  },
  {
    key: "enterprise",
    envKey: "STRIPE_PRICE_ISYTASK_ENTERPRISE",
    name: "Isytask Enterprise",
    description: "Para grandes agencias y multi-cuenta",
    price: 19900, // cents
    features: [
      "Usuarios ilimitados",
      "Colaboradores externos ilimitados",
      "Tareas ilimitadas",
      "Multi-agencia",
      "Advanced analytics & BI",
      "SSO / SAML",
      "Soporte prioritario 24/7",
      "SLA 99.9%",
      "API completo + webhooks",
      "Custom branding",
      "Account manager dedicado",
    ],
    metadata: {
      tier: "enterprise",
      product: "ISYTASK",
      max_internal_users: "unlimited",
      max_tasks_per_month: "unlimited",
      whatsapp_integrations: "unlimited",
      ai_features: "full",
      sla: "99.9",
    },
  },
];

const ISYSOCIAL_PLANS = [
  {
    key: "basic",
    envKey: "STRIPE_PRICE_ISYSOCIAL_BASIC",
    name: "Isysocial Starter",
    description: "Para gestión básica de redes sociales",
    price: 2900,
    features: [
      "2 redes sociales",
      "Hasta 50 posts/mes",
      "Calendario básico",
      "Stories Studio básico",
      "Soporte por email",
    ],
    metadata: {
      tier: "basic",
      product: "ISYSOCIAL",
      max_social_accounts: "2",
      max_posts_per_month: "50",
    },
  },
  {
    key: "pro",
    envKey: "STRIPE_PRICE_ISYSOCIAL_PRO",
    name: "Isysocial Profesional",
    description: "Para agencias con múltiples clientes sociales",
    price: 7900,
    features: [
      "10 redes sociales",
      "Posts ilimitados",
      "Calendario completo",
      "Isystory Studio completo",
      "Copy con IA",
      "Analytics avanzados",
      "Soporte prioritario",
    ],
    metadata: {
      tier: "pro",
      product: "ISYSOCIAL",
      max_social_accounts: "10",
      max_posts_per_month: "unlimited",
      ai_copy: "true",
    },
  },
  {
    key: "enterprise",
    envKey: "STRIPE_PRICE_ISYSOCIAL_ENTERPRISE",
    name: "Isysocial Enterprise",
    description: "Para grandes operaciones de social media",
    price: 19900,
    features: [
      "Redes sociales ilimitadas",
      "Posts ilimitados",
      "White-label disponible",
      "API completo",
      "Soporte 24/7",
      "Account manager",
    ],
    metadata: {
      tier: "enterprise",
      product: "ISYSOCIAL",
      max_social_accounts: "unlimited",
      max_posts_per_month: "unlimited",
      white_label: "available",
    },
  },
];

// ── ADD-ONS ──────────────────────────────────────────────────────
const ADDONS = [
  {
    key: "extra_user",
    name: "Usuario Extra",
    description: "Agrega un usuario interno adicional a tu plan",
    price: 900, // $9/mes
    metadata: { type: "addon", addon_type: "extra_user" },
  },
  {
    key: "whatsapp_premium",
    name: "WhatsApp Premium",
    description: "Mayor throughput y más números de WhatsApp",
    price: 1900, // $19/mes
    metadata: { type: "addon", addon_type: "whatsapp_premium" },
  },
  {
    key: "advanced_ai",
    name: "IA Avanzada",
    description: "Más tokens mensuales para funciones de IA",
    price: 2900, // $29/mes
    metadata: { type: "addon", addon_type: "advanced_ai" },
  },
  {
    key: "isystory_studio",
    name: "Isystory Studio",
    description: "Editor de stories para Instagram",
    price: 3900, // $39/mes
    metadata: { type: "addon", addon_type: "isystory_studio" },
  },
];

// ── Helpers ───────────────────────────────────────────────────────

async function getOrCreateProduct(name: string, description: string, metadata: Record<string, string>): Promise<Stripe.Product> {
  // Search for existing product by metadata
  const products = await stripe.products.list({ limit: 100 });
  const existing = products.data.find(
    (p) => p.metadata.product === metadata.product && p.metadata.tier === metadata.tier
  );

  if (existing && existing.active) {
    console.log(`  ✓ Producto ya existe: ${name} (${existing.id})`);
    return existing;
  }

  const product = await stripe.products.create({
    name,
    description,
    metadata,
  });

  console.log(`  + Producto creado: ${name} (${product.id})`);
  return product;
}

async function createNewPrice(productId: string, amount: number, currency = "usd"): Promise<Stripe.Price> {
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amount,
    currency,
    recurring: {
      interval: "month",
    },
  });
  return price;
}

async function archiveOldPrices(productId: string, keepPriceId?: string) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  for (const price of prices.data) {
    if (price.id !== keepPriceId) {
      await stripe.prices.update(price.id, { active: false });
      console.log(`  - Precio archivado: ${price.id}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log("\n🔧 Setup Stripe Plans — Isytask / Isysocial\n");
  console.log("Modo: TEST (usa test keys)");
  console.log("─".repeat(50));

  const newEnvVars: Record<string, string> = {};

  // Process Isytask plans
  console.log("\n📋 ISYTASK Plans:");
  for (const plan of ISYTASK_PLANS) {
    console.log(`\n  [${plan.key.toUpperCase()}] ${plan.name} — $${plan.price / 100}/mes`);

    const product = await getOrCreateProduct(plan.name, plan.description, plan.metadata);

    // Check if existing price already matches amount
    const existingPrices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
    const existingCorrectPrice = existingPrices.data.find(
      (p) => p.unit_amount === plan.price && p.recurring?.interval === "month"
    );

    let priceId: string;

    if (existingCorrectPrice) {
      console.log(`  ✓ Precio ya correcto: $${plan.price / 100} (${existingCorrectPrice.id})`);
      priceId = existingCorrectPrice.id;
    } else {
      // Archive old prices
      await archiveOldPrices(product.id);
      // Create new price
      const newPrice = await createNewPrice(product.id, plan.price);
      console.log(`  + Precio creado: $${plan.price / 100}/mes (${newPrice.id})`);
      priceId = newPrice.id;
    }

    newEnvVars[plan.envKey] = priceId;
  }

  // Process Isysocial plans
  console.log("\n📱 ISYSOCIAL Plans:");
  for (const plan of ISYSOCIAL_PLANS) {
    console.log(`\n  [${plan.key.toUpperCase()}] ${plan.name} — $${plan.price / 100}/mes`);

    const product = await getOrCreateProduct(plan.name, plan.description, plan.metadata);

    const existingPrices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
    const existingCorrectPrice = existingPrices.data.find(
      (p) => p.unit_amount === plan.price && p.recurring?.interval === "month"
    );

    let priceId: string;

    if (existingCorrectPrice) {
      console.log(`  ✓ Precio ya correcto: $${plan.price / 100} (${existingCorrectPrice.id})`);
      priceId = existingCorrectPrice.id;
    } else {
      await archiveOldPrices(product.id);
      const newPrice = await createNewPrice(product.id, plan.price);
      console.log(`  + Precio creado: $${plan.price / 100}/mes (${newPrice.id})`);
      priceId = newPrice.id;
    }

    newEnvVars[plan.envKey] = priceId;
  }

  // Also create annual prices (20% discount)
  console.log("\n📅 Annual Plans (20% descuento):");
  const annualPlans = [
    { name: "Isytask Starter Anual", price: 27840, metadata: { tier: "basic", product: "ISYTASK", billing: "annual" } }, // $29 * 12 * 0.8 = $278.40
    { name: "Isytask Pro Anual", price: 75840, metadata: { tier: "pro", product: "ISYTASK", billing: "annual" } },       // $79 * 12 * 0.8 = $758.40
    { name: "Isytask Enterprise Anual", price: 191040, metadata: { tier: "enterprise", product: "ISYTASK", billing: "annual" } },
  ];

  for (const plan of annualPlans) {
    console.log(`  [ANNUAL] ${plan.name} — $${plan.price / 100}/año`);
    // Just checking/creating products here without modifying existing ones
    const products = await stripe.products.list({ limit: 100 });
    const baseProduct = products.data.find(
      (p) => p.metadata.product === plan.metadata.product && p.metadata.tier === plan.metadata.tier && !p.metadata.billing
    );

    if (baseProduct) {
      const annualPrices = await stripe.prices.list({ product: baseProduct.id, active: true, limit: 10 });
      const existingAnnual = annualPrices.data.find(
        (p) => p.unit_amount === plan.price && p.recurring?.interval === "year"
      );

      if (existingAnnual) {
        console.log(`  ✓ Precio anual ya existe (${existingAnnual.id})`);
        if (plan.metadata.tier === "basic" && plan.metadata.product === "ISYTASK") {
          newEnvVars["STRIPE_PRICE_ISYTASK_BASIC_ANNUAL"] = existingAnnual.id;
        } else if (plan.metadata.tier === "pro" && plan.metadata.product === "ISYTASK") {
          newEnvVars["STRIPE_PRICE_ISYTASK_PRO_ANNUAL"] = existingAnnual.id;
        }
      } else {
        const annualPrice = await stripe.prices.create({
          product: baseProduct.id,
          unit_amount: plan.price,
          currency: "usd",
          recurring: { interval: "year" },
          nickname: `${plan.name} (Anual)`,
        });
        console.log(`  + Precio anual creado: $${plan.price / 100}/año (${annualPrice.id})`);
        if (plan.metadata.tier === "basic" && plan.metadata.product === "ISYTASK") {
          newEnvVars["STRIPE_PRICE_ISYTASK_BASIC_ANNUAL"] = annualPrice.id;
        } else if (plan.metadata.tier === "pro" && plan.metadata.product === "ISYTASK") {
          newEnvVars["STRIPE_PRICE_ISYTASK_PRO_ANNUAL"] = annualPrice.id;
        }
      }
    }
  }

  // Print summary
  console.log("\n" + "═".repeat(50));
  console.log("✅ COMPLETADO — Price IDs actualizados:\n");

  for (const [key, value] of Object.entries(newEnvVars)) {
    console.log(`${key}="${value}"`);
  }

  // Update .env file
  const envPath = path.resolve(__dirname, "../apps/web/.env");
  let envContent = fs.readFileSync(envPath, "utf-8");

  let updated = 0;
  for (const [key, value] of Object.entries(newEnvVars)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}="${value}"`);
      updated++;
    } else {
      // Add new line
      envContent += `\n${key}="${value}"`;
      updated++;
    }
  }

  fs.writeFileSync(envPath, envContent, "utf-8");
  console.log(`\n📄 .env actualizado (${updated} variables)\n`);

  console.log("🎯 Próximos pasos:");
  console.log("  1. Verificar productos en: https://dashboard.stripe.com/test/products");
  console.log("  2. Deploy para usar nuevos price IDs en producción");
  console.log("  3. Copiar los price IDs a las variables de entorno de Vercel\n");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
