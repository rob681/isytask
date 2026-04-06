/**
 * Health Check & Integration Status — Isytask
 *
 * Returns:
 *   - App status
 *   - Database connectivity
 *   - Event bus health metrics
 *   - Stripe configuration status
 *   - Cross-app integration status
 */

import { NextResponse } from "next/server";
import { db } from "@isytask/db";
import { getEventBusHealth } from "@isytask/api";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const isAuthed = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  const health: Record<string, any> = {
    status: "ok",
    product: "ISYTASK",
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
  };

  if (isAuthed) {
    try {
      await db.$queryRaw`SELECT 1`;
      health.database = "connected";
    } catch {
      health.database = "disconnected";
      health.status = "degraded";
    }

    try {
      const result = await db.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as count FROM shared.organizations`
      );
      health.sharedSchema = {
        available: true,
        organizations: Number(result[0]?.count ?? 0),
      };
    } catch {
      health.sharedSchema = { available: false };
    }

    try {
      health.eventBus = await getEventBusHealth(db, "ISYTASK");
      if (health.eventBus.deadLetter > 0) {
        health.status = "degraded";
        health.alerts = health.alerts || [];
        health.alerts.push(
          `${health.eventBus.deadLetter} events in dead letter queue`
        );
      }
    } catch {
      health.eventBus = { error: "shared schema not available" };
    }

    health.config = {
      stripe: !!process.env.STRIPE_SECRET_KEY,
      stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
      crossAppSecret: !!process.env.CROSS_APP_SECRET,
      isysocialWebhookUrl: process.env.ISYSOCIAL_WEBHOOK_URL || "not configured",
      supabase: !!process.env.SUPABASE_URL,
      twilio: !!process.env.TWILIO_ACCOUNT_SID,
    };
  }

  return NextResponse.json(health);
}
