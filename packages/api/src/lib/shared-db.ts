/**
 * Shared Database Layer
 *
 * Provides type-safe access to the `shared` schema tables.
 * Both Isytask and Isysocial use identical copies of this file.
 *
 * Tables:
 *   shared.organizations     — Unified company identity
 *   shared.subscriptions     — Per-product billing state
 *   shared.cross_app_events  — Reliable event bus
 *   shared.sso_sessions      — Cross-product authentication
 */

import type { PrismaClient } from "@isytask/db";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Product = "ISYTASK" | "ISYSOCIAL";
export type PlanTier = "basic" | "pro" | "enterprise";
export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled" | "expired";
export type EventStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED" | "DEAD_LETTER";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  isytask_agency_id: string | null;
  isysocial_agency_id: string | null;
  stripe_customer_id: string | null;
  primary_contact_email: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SharedSubscription {
  id: string;
  organization_id: string;
  product: Product;
  plan_tier: PlanTier;
  status: SubscriptionStatus;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  current_period_start: Date | null;
  current_period_end: Date | null;
  trial_ends_at: Date | null;
  canceled_at: Date | null;
  cancel_at_period_end: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CrossAppEvent {
  id: string;
  organization_id: string;
  source_app: Product;
  target_app: Product;
  event_type: string;
  status: EventStatus;
  payload: Record<string, any>;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: Date | null;
  processed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SSOSession {
  id: string;
  organization_id: string;
  email: string;
  token: string;
  source_app: Product;
  user_name: string | null;
  user_role: string | null;
  user_avatar_url: string | null;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

// ─── Organization Queries ────────────────────────────────────────────────────

/**
 * Get Organization by product-specific agency ID
 */
export async function getOrganizationByAgencyId(
  db: PrismaClient,
  product: Product,
  agencyId: string
): Promise<Organization | null> {
  const column = product === "ISYTASK" ? "isytask_agency_id" : "isysocial_agency_id";
  const rows = await db.$queryRawUnsafe<Organization[]>(
    `SELECT * FROM shared.organizations WHERE ${column} = $1 LIMIT 1`,
    agencyId
  );
  return rows[0] ?? null;
}

/**
 * Get or create Organization from a product agency
 */
export async function getOrCreateOrganization(
  db: PrismaClient,
  product: Product,
  agencyId: string,
  agencyName: string,
  opts?: { stripeCustomerId?: string; contactEmail?: string }
): Promise<Organization> {
  const existing = await getOrganizationByAgencyId(db, product, agencyId);
  if (existing) return existing;

  const column = product === "ISYTASK" ? "isytask_agency_id" : "isysocial_agency_id";
  const slug = agencyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const rows = await db.$queryRawUnsafe<Organization[]>(
    `INSERT INTO shared.organizations (name, slug, ${column}, stripe_customer_id, primary_contact_email)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (${column}) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING *`,
    agencyName,
    slug + "-" + Date.now().toString(36),
    agencyId,
    opts?.stripeCustomerId ?? null,
    opts?.contactEmail ?? null
  );
  return rows[0]!;
}

/**
 * Link a second product's agency to an existing Organization
 */
export async function linkAgencyToOrganization(
  db: PrismaClient,
  organizationId: string,
  product: Product,
  agencyId: string
): Promise<void> {
  const column = product === "ISYTASK" ? "isytask_agency_id" : "isysocial_agency_id";
  await db.$queryRawUnsafe(
    `UPDATE shared.organizations SET ${column} = $1, updated_at = now() WHERE id = $2`,
    agencyId,
    organizationId
  );
}

// ─── Subscription Queries ────────────────────────────────────────────────────

/**
 * Check if an organization has an active subscription for a product
 */
export async function hasActiveSubscription(
  db: PrismaClient,
  organizationId: string,
  product: Product
): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM shared.subscriptions
     WHERE organization_id = $1 AND product = $2 AND status IN ('trial', 'active')`,
    organizationId,
    product
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

/**
 * Check subscription by product-specific agency ID (convenience method)
 */
export async function hasActiveSubscriptionByAgency(
  db: PrismaClient,
  product: Product,
  agencyId: string
): Promise<boolean> {
  const column = product === "ISYTASK" ? "isytask_agency_id" : "isysocial_agency_id";
  const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM shared.subscriptions s
     JOIN shared.organizations o ON o.id = s.organization_id
     WHERE o.${column} = $1 AND s.product = $2 AND s.status IN ('trial', 'active')`,
    agencyId,
    product
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

/**
 * Get all active subscriptions for an organization
 */
export async function getOrganizationSubscriptions(
  db: PrismaClient,
  organizationId: string
): Promise<SharedSubscription[]> {
  return db.$queryRawUnsafe<SharedSubscription[]>(
    `SELECT * FROM shared.subscriptions WHERE organization_id = $1 ORDER BY created_at ASC`,
    organizationId
  );
}

/**
 * Get subscription for a specific product
 */
export async function getSubscription(
  db: PrismaClient,
  organizationId: string,
  product: Product
): Promise<SharedSubscription | null> {
  const rows = await db.$queryRawUnsafe<SharedSubscription[]>(
    `SELECT * FROM shared.subscriptions WHERE organization_id = $1 AND product = $2 LIMIT 1`,
    organizationId,
    product
  );
  return rows[0] ?? null;
}

/**
 * Upsert subscription (used by Stripe webhook handlers)
 */
export async function upsertSubscription(
  db: PrismaClient,
  data: {
    organizationId: string;
    product: Product;
    planTier: PlanTier;
    status: SubscriptionStatus;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    trialEndsAt?: Date;
    canceledAt?: Date | null;
  }
): Promise<SharedSubscription> {
  const rows = await db.$queryRawUnsafe<SharedSubscription[]>(
    `INSERT INTO shared.subscriptions (
       organization_id, product, plan_tier, status,
       stripe_subscription_id, stripe_price_id,
       current_period_start, current_period_end,
       trial_ends_at, canceled_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (organization_id, product) DO UPDATE SET
       plan_tier = EXCLUDED.plan_tier,
       status = EXCLUDED.status,
       stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, shared.subscriptions.stripe_subscription_id),
       stripe_price_id = COALESCE(EXCLUDED.stripe_price_id, shared.subscriptions.stripe_price_id),
       current_period_start = COALESCE(EXCLUDED.current_period_start, shared.subscriptions.current_period_start),
       current_period_end = COALESCE(EXCLUDED.current_period_end, shared.subscriptions.current_period_end),
       trial_ends_at = COALESCE(EXCLUDED.trial_ends_at, shared.subscriptions.trial_ends_at),
       canceled_at = EXCLUDED.canceled_at,
       updated_at = now()
     RETURNING *`,
    data.organizationId,
    data.product,
    data.planTier,
    data.status,
    data.stripeSubscriptionId ?? null,
    data.stripePriceId ?? null,
    data.currentPeriodStart ?? null,
    data.currentPeriodEnd ?? null,
    data.trialEndsAt ?? null,
    data.canceledAt ?? null
  );
  return rows[0]!;
}

/**
 * Check if organization has both products (for cross-product discount)
 */
export async function hasBothProducts(
  db: PrismaClient,
  organizationId: string
): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(DISTINCT product) as count FROM shared.subscriptions
     WHERE organization_id = $1 AND status IN ('trial', 'active')`,
    organizationId
  );
  return Number(rows[0]?.count ?? 0) >= 2;
}

// ─── Cross-App Event Queries ─────────────────────────────────────────────────

/**
 * Queue a new cross-app event
 */
export async function queueEvent(
  db: PrismaClient,
  data: {
    organizationId: string;
    sourceApp: Product;
    targetApp: Product;
    eventType: string;
    payload: Record<string, any>;
  }
): Promise<CrossAppEvent> {
  const rows = await db.$queryRawUnsafe<CrossAppEvent[]>(
    `INSERT INTO shared.cross_app_events (
       organization_id, source_app, target_app, event_type, payload, next_retry_at
     ) VALUES ($1, $2, $3, $4, $5::jsonb, now())
     RETURNING *`,
    data.organizationId,
    data.sourceApp,
    data.targetApp,
    data.eventType,
    JSON.stringify(data.payload)
  );
  return rows[0]!;
}

/**
 * Fetch pending events for a target app, ready for processing.
 * Uses SELECT FOR UPDATE SKIP LOCKED for concurrent safety.
 */
export async function fetchPendingEvents(
  db: PrismaClient,
  targetApp: Product,
  limit = 50
): Promise<CrossAppEvent[]> {
  return db.$queryRawUnsafe<CrossAppEvent[]>(
    `UPDATE shared.cross_app_events
     SET status = 'PROCESSING', updated_at = now()
     WHERE id IN (
       SELECT id FROM shared.cross_app_events
       WHERE target_app = $1
         AND status IN ('PENDING', 'FAILED')
         AND retry_count < max_retries
         AND (next_retry_at IS NULL OR next_retry_at <= now())
       ORDER BY created_at ASC
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    targetApp,
    limit
  );
}

/**
 * Mark event as done
 */
export async function markEventDone(db: PrismaClient, eventId: string): Promise<void> {
  await db.$queryRawUnsafe(
    `UPDATE shared.cross_app_events
     SET status = 'DONE', processed_at = now(), updated_at = now()
     WHERE id = $1`,
    eventId
  );
}

/**
 * Mark event as failed with retry scheduling (exponential backoff)
 */
export async function markEventFailed(
  db: PrismaClient,
  eventId: string,
  errorMessage: string
): Promise<void> {
  await db.$queryRawUnsafe(
    `UPDATE shared.cross_app_events
     SET
       status = CASE
         WHEN retry_count + 1 >= max_retries THEN 'DEAD_LETTER'
         ELSE 'FAILED'
       END,
       error_message = $2,
       retry_count = retry_count + 1,
       next_retry_at = now() + (POWER(2, LEAST(retry_count + 1, 8)) || ' minutes')::interval,
       updated_at = now()
     WHERE id = $1`,
    eventId,
    errorMessage
  );
}

/**
 * Get event bus health metrics for a target app
 */
export async function getEventBusHealth(
  db: PrismaClient,
  targetApp?: Product
): Promise<{
  pending: number;
  processing: number;
  failed: number;
  deadLetter: number;
  doneToday: number;
}> {
  const filter = targetApp ? `AND target_app = '${targetApp}'` : "";
  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
       COUNT(*) FILTER (WHERE status = 'PROCESSING') as processing,
       COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
       COUNT(*) FILTER (WHERE status = 'DEAD_LETTER') as dead_letter,
       COUNT(*) FILTER (WHERE status = 'DONE' AND processed_at >= CURRENT_DATE) as done_today
     FROM shared.cross_app_events
     WHERE 1=1 ${filter}`
  );
  const r = rows[0];
  return {
    pending: Number(r?.pending ?? 0),
    processing: Number(r?.processing ?? 0),
    failed: Number(r?.failed ?? 0),
    deadLetter: Number(r?.dead_letter ?? 0),
    doneToday: Number(r?.done_today ?? 0),
  };
}

// ─── SSO Session Queries ─────────────────────────────────────────────────────

/**
 * Create an SSO session token for cross-product navigation
 */
export async function createSSOSession(
  db: PrismaClient,
  data: {
    organizationId: string;
    email: string;
    sourceApp: Product;
    userName?: string;
    userRole?: string;
    userAvatarUrl?: string;
    ttlMinutes?: number;
  }
): Promise<SSOSession> {
  const token = crypto.randomUUID() + "-" + crypto.randomUUID();
  const ttl = data.ttlMinutes ?? 5;
  const rows = await db.$queryRawUnsafe<SSOSession[]>(
    `INSERT INTO shared.sso_sessions (
       organization_id, email, token, source_app,
       user_name, user_role, user_avatar_url,
       expires_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, now() + ($8 || ' minutes')::interval)
     RETURNING *`,
    data.organizationId,
    data.email,
    token,
    data.sourceApp,
    data.userName ?? null,
    data.userRole ?? null,
    data.userAvatarUrl ?? null,
    String(ttl)
  );
  return rows[0]!;
}

/**
 * Consume an SSO session token (one-time use)
 */
export async function consumeSSOSession(
  db: PrismaClient,
  token: string
): Promise<SSOSession | null> {
  const rows = await db.$queryRawUnsafe<SSOSession[]>(
    `UPDATE shared.sso_sessions
     SET used_at = now()
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING *`,
    token
  );
  return rows[0] ?? null;
}

/**
 * Clean up expired SSO sessions (call from cron)
 */
export async function cleanupExpiredSSOSessions(db: PrismaClient): Promise<number> {
  const result = await db.$queryRawUnsafe<{ count: bigint }[]>(
    `WITH deleted AS (
       DELETE FROM shared.sso_sessions WHERE expires_at < now() - interval '1 hour' RETURNING 1
     ) SELECT COUNT(*) as count FROM deleted`
  );
  return Number(result[0]?.count ?? 0);
}
