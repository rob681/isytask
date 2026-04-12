const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@isytask/api", "@isytask/db", "@isytask/shared"],
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
    outputFileTracingIncludes: {
      "/**": ["apps/web/generated/prisma/*.node"],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js needs unsafe-inline for hydration scripts; unsafe-eval for dev HMR
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://js.stripe.com",
      // Tailwind/CSS-in-JS requires unsafe-inline for styles
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Allow Supabase images and data: for base64 avatars
      "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
      // API connections: own server, Supabase, Stripe
      "connect-src 'self' https://*.supabase.co https://api.stripe.com https://www.google.com https://vitals.vercel-insights.com",
      // Stripe payment iframe
      "frame-src https://js.stripe.com https://hooks.stripe.com https://www.google.com",
      // Block plugins and object embeds entirely
      "object-src 'none'",
      // Prevent base tag hijacking
      "base-uri 'self'",
      // Restrict form submissions to own origin
      "form-action 'self'",
      // Block mixed content
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
