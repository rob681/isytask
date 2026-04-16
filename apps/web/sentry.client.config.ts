/**
 * Sentry — Client-side error monitoring
 * DSN: set NEXT_PUBLIC_SENTRY_DSN in Vercel env vars
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Don't send errors in development
  enabled: process.env.NODE_ENV === "production",

  // Capture 10% of sessions for performance monitoring (Hobby plan friendly)
  tracesSampleRate: 0.1,

  // Capture 20% of sessions for session replay (only on errors)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0, // Don't capture sessions without errors

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and block all media to protect user privacy
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Don't send errors for these common non-issues
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    "ChunkLoadError",
    "Loading chunk",
  ],

  // Tag all events with app name for easier filtering
  initialScope: {
    tags: { app: "isytask" },
  },
});
