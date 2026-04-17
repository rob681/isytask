/**
 * Sentry — Server-side error monitoring
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  // Higher sample rate on server — more critical errors
  tracesSampleRate: 0.2,

  initialScope: {
    tags: { app: "isytask", runtime: "server" },
  },
});
