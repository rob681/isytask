import Stripe from "/Users/imac/Desktop/Claude Rob/isytask/node_modules/.pnpm/stripe@20.4.1_@types+node@22.19.15/node_modules/stripe/esm/stripe.mjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const prices = [
  { id: "price_1TBlFAEpTOsHfhZtojnoXZPo", label: "Isytask Básico" },
  { id: "price_1TBlFBEpTOsHfhZtGAAvwbuH", label: "Isytask Pro" },
  { id: "price_1TBlFBEpTOsHfhZtv2DivLh1", label: "Isytask Enterprise" },
  { id: "price_1TBlFCEpTOsHfhZtmm6VoTRY", label: "Isysocial Básico" },
  { id: "price_1TBlFDEpTOsHfhZtbJU0iq7q", label: "Isysocial Pro" },
  { id: "price_1TBlFDEpTOsHfhZtDyJSnycX", label: "Isysocial Enterprise" },
];

for (const p of prices) {
  const price = await stripe.prices.retrieve(p.id);
  console.log(`${p.label}: $${(price.unit_amount ?? 0) / 100}/mes`);
}
