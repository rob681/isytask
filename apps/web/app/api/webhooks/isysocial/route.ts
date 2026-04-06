/**
 * Webhook receiver for Isysocial → Isytask events
 * Simply queues the event for async processing
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@isytask/db";

const CROSS_APP_SECRET = process.env.CROSS_APP_SECRET;

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-cross-app-secret");

    if (!CROSS_APP_SECRET || !signature || signature !== CROSS_APP_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { eventType, agencyId, payload } = body;

    if (!eventType || !agencyId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create cross-app event for processing
    const event = await db.crossAppEvent.create({
      data: {
        sourceApp: "ISYSOCIAL",
        targetApp: "ISYTASK",
        eventType,
        agencyId,
        payload: payload || {},
        isysocialPostId: payload?.postId,
        status: "PENDING",
      },
    });

    // Note: Event will be processed by cron job `/api/cron/cross-app-sync`
    // or can be triggered manually via tRPC

    return NextResponse.json(
      {
        success: true,
        eventId: event.id,
        message: "Event queued for processing",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[IsysocialWebhook]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET: Health check
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "isytask-isysocial-webhook",
    timestamp: new Date().toISOString(),
  });
}
