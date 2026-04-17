/**
 * Sentry — Edge runtime (middleware) error monitoring
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  initialScope: { tags: { app: "isytask", runtime: "edge" } },
});
