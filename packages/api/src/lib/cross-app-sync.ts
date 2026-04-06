/**
 * Cross-App Synchronization Engine
 * Handles bidirectional event processing between Isytask and Isysocial
 */

import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@isytask/db";
import {
  CrossAppEventStatus,
  Product,
  TaskStatus,
} from "@isytask/db";
import {
  queueEvent as queueSharedEvent,
  getOrganizationByAgencyId,
} from "./shared-db";

export type CrossAppEventType =
  | "POST_REJECTED"
  | "POST_APPROVED"
  | "POST_IN_REVIEW"
  | "POST_PUBLISHED"
  | "TASK_IN_REVISION"
  | "TASK_FINALIZADA"
  | "TASK_CANCELADA"
  | "TASK_CREATED_WITH_POST"
  | "OAUTH_EXPIRED";

export interface CrossAppEventPayload {
  [key: string]: any;
}

/**
 * Insert a cross-app event for async processing
 */
export async function queueCrossAppEvent(
  db: PrismaClient,
  sourceApp: Product,
  targetApp: Product,
  eventType: CrossAppEventType,
  agencyId: string,
  payload: CrossAppEventPayload,
  references?: {
    taskId?: string;
    isysocialPostId?: string;
  }
) {
  try {
    const event = await db.crossAppEvent.create({
      data: {
        sourceApp,
        targetApp,
        eventType,
        agencyId,
        payload,
        taskId: references?.taskId,
        isysocialPostId: references?.isysocialPostId,
        status: CrossAppEventStatus.PENDING,
      },
    });

    // Fire-and-forget
    setImmediate(() => processCrossAppEvent(db, event.id).catch(console.error));

    return event;
  } catch (error) {
    console.error(`[CrossAppSync] Failed to queue event:`, error);
    throw error;
  }
}

/**
 * Process a single cross-app event
 */
export async function processCrossAppEvent(db: PrismaClient, eventId: string) {
  const event = await db.crossAppEvent.findUnique({
    where: { id: eventId },
    include: { task: true },
  });

  if (!event) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Event ${eventId} not found`,
    });
  }

  // Prevent infinite retries — move to dead letter after 5 attempts
  if (event.retryCount >= 5) {
    await db.crossAppEvent.update({
      where: { id: eventId },
      data: {
        status: CrossAppEventStatus.FAILED,
        errorMessage: `Dead letter: Max retries (${event.retryCount}) exceeded`,
      },
    });
    console.error(`[CrossAppSync] Event ${eventId} moved to dead letter after ${event.retryCount} retries`);
    return;
  }

  try {
    await db.crossAppEvent.update({
      where: { id: eventId },
      data: { status: CrossAppEventStatus.PROCESSING },
    });

    // Route to appropriate handler
    switch (event.sourceApp) {
      case Product.ISYSOCIAL:
        await handleIsysocialEvent(db, event);
        break;
      case Product.ISYTASK:
        await handleIsytaskEvent(db, event);
        break;
      default:
        throw new Error(`Unknown source app: ${event.sourceApp}`);
    }

    // Mark as done
    await db.crossAppEvent.update({
      where: { id: eventId },
      data: {
        status: CrossAppEventStatus.DONE,
        processedAt: new Date(),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Retry logic
    await db.crossAppEvent.update({
      where: { id: eventId },
      data: {
        status: CrossAppEventStatus.PENDING,
        errorMessage,
        retryCount: event.retryCount + 1,
      },
    });

    console.error(
      `[CrossAppSync] Error processing event ${eventId}:`,
      errorMessage
    );
  }
}

/**
 * Handle events from Isysocial → Isytask
 */
async function handleIsysocialEvent(db: PrismaClient, event: any) {
  const { eventType, payload, agencyId } = event;

  // Verify subscriptions
  const hasIsytask = await checkSubscription(db, agencyId, Product.ISYTASK);
  const hasIsysocial = await checkSubscription(db, agencyId, Product.ISYSOCIAL);

  if (!hasIsytask || !hasIsysocial) {
    console.warn(
      `[CrossAppSync] Agency ${agencyId} doesn't have both subscriptions`
    );
    return;
  }

  switch (eventType) {
    case "POST_REJECTED":
      await handlePostRejected(db, agencyId, payload);
      break;
    case "POST_APPROVED":
      await handlePostApproved(db, agencyId, payload);
      break;
    case "POST_IN_REVIEW":
      await handlePostInReview(db, agencyId, payload);
      break;
    case "POST_PUBLISHED":
      await handlePostPublished(db, agencyId, payload);
      break;
    case "OAUTH_EXPIRED":
      await handleOAuthExpired(db, agencyId, payload);
      break;
    default:
      throw new Error(`Unknown event type: ${eventType}`);
  }
}

/**
 * Handle events from Isytask → Isysocial
 */
async function handleIsytaskEvent(db: PrismaClient, event: any) {
  const { eventType, payload, agencyId } = event;

  // Verify subscriptions
  const hasIsytask = await checkSubscription(db, agencyId, Product.ISYTASK);
  const hasIsysocial = await checkSubscription(db, agencyId, Product.ISYSOCIAL);

  if (!hasIsytask || !hasIsysocial) {
    console.warn(
      `[CrossAppSync] Agency ${agencyId} doesn't have both subscriptions`
    );
    return;
  }

  switch (eventType) {
    case "TASK_IN_REVISION":
      await handleTaskInRevision(db, agencyId, payload);
      break;
    case "TASK_FINALIZADA":
      await handleTaskFinalized(db, agencyId, payload);
      break;
    case "TASK_CREATED_WITH_POST":
      await handleTaskCreatedWithPost(db, agencyId, payload);
      break;
    default:
      throw new Error(`Unknown event type: ${eventType}`);
  }
}

// Event handlers (Isysocial → Isytask)

async function handlePostRejected(db: PrismaClient, agencyId: string, payload: any) {
  const { postId, feedback, taskId: linkedTaskId } = payload;

  if (!linkedTaskId) return;

  await db.task.update({
    where: { id: linkedTaskId },
    data: { status: TaskStatus.EN_PROGRESO, updatedAt: new Date() },
  });

  await db.taskComment.create({
    data: {
      taskId: linkedTaskId,
      authorId: "system",
      content: `[Isysocial] Cliente solicitó cambios: ${feedback}`,
      isQuestion: false,
      isInternal: false,
    },
  });
}

async function handlePostApproved(db: PrismaClient, agencyId: string, payload: any) {
  const { taskId: linkedTaskId } = payload;

  if (!linkedTaskId) return;

  await db.task.update({
    where: { id: linkedTaskId },
    data: {
      status: TaskStatus.FINALIZADA,
      completedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

async function handlePostInReview(db: PrismaClient, agencyId: string, payload: any) {
  const { taskId: linkedTaskId } = payload;

  if (!linkedTaskId) return;

  const task = await db.task.findUnique({
    where: { id: linkedTaskId },
  });

  if (task && task.status === TaskStatus.EN_PROGRESO) {
    await db.task.update({
      where: { id: linkedTaskId },
      data: { status: TaskStatus.REVISION, updatedAt: new Date() },
    });
  }
}

async function handlePostPublished(db: PrismaClient, agencyId: string, payload: any) {
  const { taskId: linkedTaskId, networks, reach } = payload;

  if (!linkedTaskId) return;

  await db.taskComment.create({
    data: {
      taskId: linkedTaskId,
      authorId: "system",
      content: `[Isysocial] Publicado en: ${networks?.join(", ")}. Alcance: ${reach || "calculando..."}`,
      isQuestion: false,
      isInternal: false,
    },
  });
}

async function handleOAuthExpired(db: PrismaClient, agencyId: string, payload: any) {
  console.log("[CrossAppSync] OAuth expired for agency:", agencyId);
  // Implementation would create urgent task
}

// Event handlers (Isytask → Isysocial)

async function handleTaskInRevision(db: PrismaClient, agencyId: string, payload: any) {
  const { postId: linkedPostId } = payload;

  if (!linkedPostId) return;

  // Write to shared event bus for reliable delivery
  await writeToSharedEventBus(db, agencyId, "TASK_IN_REVISION", payload);
  // Also call webhook directly for low latency
  await callIsysocialWebhook("TASK_IN_REVISION", agencyId, payload);
}

async function handleTaskFinalized(db: PrismaClient, agencyId: string, payload: any) {
  const { postId: linkedPostId } = payload;

  if (!linkedPostId) return;

  await writeToSharedEventBus(db, agencyId, "TASK_FINALIZADA", payload);
  await callIsysocialWebhook("TASK_FINALIZADA", agencyId, payload);
}

async function handleTaskCreatedWithPost(db: PrismaClient, agencyId: string, payload: any) {
  const { clientId } = payload;

  if (!clientId) return;

  await writeToSharedEventBus(db, agencyId, "TASK_CREATED_WITH_POST", payload);
  await callIsysocialWebhook("TASK_CREATED_WITH_POST", agencyId, payload);
}

/**
 * Write event to shared.cross_app_events for reliable cross-product delivery.
 * Falls back silently if shared schema is not available.
 */
async function writeToSharedEventBus(
  db: PrismaClient,
  agencyId: string,
  eventType: string,
  payload: any
) {
  try {
    const org = await getOrganizationByAgencyId(db, "ISYTASK", agencyId);
    if (!org) return;

    await queueSharedEvent(db, {
      organizationId: org.id,
      sourceApp: "ISYTASK",
      targetApp: "ISYSOCIAL",
      eventType,
      payload,
    });
  } catch (error) {
    // Don't fail the main flow if shared DB isn't ready
    console.warn("[CrossAppSync] Failed to write to shared event bus:", error);
  }
}

/**
 * Call Isysocial webhook
 */
async function callIsysocialWebhook(
  eventType: string,
  agencyId: string,
  payload: any
) {
  const webhookUrl =
    process.env.ISYSOCIAL_WEBHOOK_URL || "https://isysocial-web.vercel.app";
  const secret = process.env.CROSS_APP_SECRET;

  if (!secret) {
    console.warn("[CrossAppSync] CROSS_APP_SECRET not configured");
    return;
  }

  try {
    const response = await fetch(`${webhookUrl}/api/webhooks/isytask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cross-App-Secret": secret,
      },
      body: JSON.stringify({
        eventType,
        agencyId,
        payload,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }
  } catch (error) {
    console.error(
      `[CrossAppSync] Failed to call Isysocial webhook:`,
      error
    );
    throw error;
  }
}

/**
 * Check if agency has subscription
 */
async function checkSubscription(
  db: PrismaClient,
  agencyId: string,
  product: Product
): Promise<boolean> {
  const subscription = await db.subscription.findFirst({
    where: {
      agencyId,
      product,
      status: { not: "canceled" },
    },
  });

  return !!subscription;
}

/**
 * Process all pending events
 */
export async function processPendingEvents(db: PrismaClient) {
  const pendingEvents = await db.crossAppEvent.findMany({
    where: {
      status: CrossAppEventStatus.PENDING,
      retryCount: { lt: 3 },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  const results = await Promise.allSettled(
    pendingEvents.map((event) => processCrossAppEvent(db, event.id))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(
    `[CrossAppSync] Processed ${succeeded} succeeded, ${failed} failed`
  );

  return { succeeded, failed, total: pendingEvents.length };
}

/**
 * Emit cross-app event (wrapper for router usage)
 */
export function emitCrossAppEvent(
  db: PrismaClient,
  options: {
    sourceApp: "ISYTASK" | "ISYSOCIAL";
    targetApp: "ISYTASK" | "ISYSOCIAL";
    eventType: CrossAppEventType;
    agencyId: string;
    taskId?: string;
    isysocialPostId?: string;
    payload: any;
  }
) {
  const { sourceApp, targetApp, eventType, agencyId, taskId, isysocialPostId, payload } = options;

  const source = sourceApp === "ISYTASK" ? Product.ISYTASK : Product.ISYSOCIAL;
  const target = targetApp === "ISYTASK" ? Product.ISYTASK : Product.ISYSOCIAL;

  return queueCrossAppEvent(
    db,
    source,
    target,
    eventType,
    agencyId,
    payload,
    { taskId, isysocialPostId }
  );
}

/**
 * Check if integration is active for an agency
 */
export async function hasIntegrationActive(
  db: PrismaClient,
  agencyId: string
): Promise<boolean> {
  const hasIsytask = await checkSubscription(db, agencyId, Product.ISYTASK);
  const hasIsysocial = await checkSubscription(db, agencyId, Product.ISYSOCIAL);
  return hasIsytask && hasIsysocial;
}

/**
 * Get linked post info for a task
 */
export async function getLinkedPostInfo(
  db: PrismaClient,
  taskId: string
): Promise<{ postId: string; postType?: string } | null> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: {
      isysocialPostId: true,
      isysocialPostType: true,
    },
  });

  if (!task || !task.isysocialPostId) {
    return null;
  }

  return {
    postId: task.isysocialPostId,
    postType: task.isysocialPostType || undefined,
  };
}
