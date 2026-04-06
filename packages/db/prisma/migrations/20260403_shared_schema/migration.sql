-- ============================================================================
-- SHARED SCHEMA: Foundation for Isytask + Isysocial Independence
-- ============================================================================
-- This migration creates a shared schema that both products can access.
-- It provides:
--   1. Organization: Unified company identity across products
--   2. Subscriptions: Per-product billing state (both products read/write)
--   3. CrossAppEvents: Reliable event bus with retry & dead-letter
--   4. SSOSessions: Cross-product authentication tokens
-- ============================================================================

-- Create the shared schema
CREATE SCHEMA IF NOT EXISTS shared;

-- ─── ORGANIZATION ──────────────────────────────────────────────────────────────
-- Universal company identity. Both Isytask and Isysocial agencies link here.
-- This replaces the fragile "match by name" pattern.

CREATE TABLE shared.organizations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  slug            TEXT        NOT NULL UNIQUE,

  -- Links to product-specific agencies (nullable for single-product users)
  isytask_agency_id   TEXT    UNIQUE,
  isysocial_agency_id TEXT    UNIQUE,

  -- Shared billing identity
  stripe_customer_id  TEXT,

  -- Metadata
  primary_contact_email TEXT,
  logo_url            TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_isytask ON shared.organizations(isytask_agency_id) WHERE isytask_agency_id IS NOT NULL;
CREATE INDEX idx_organizations_isysocial ON shared.organizations(isysocial_agency_id) WHERE isysocial_agency_id IS NOT NULL;
CREATE INDEX idx_organizations_stripe ON shared.organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ─── SUBSCRIPTIONS ─────────────────────────────────────────────────────────────
-- Per-product billing state. Each product writes its own subscription,
-- and reads others to determine cross-product eligibility.

CREATE TABLE shared.subscriptions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID        NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  product               TEXT        NOT NULL CHECK (product IN ('ISYTASK', 'ISYSOCIAL')),
  plan_tier             TEXT        NOT NULL CHECK (plan_tier IN ('basic', 'pro', 'enterprise')),
  status                TEXT        NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'canceled', 'expired')),

  -- Stripe references
  stripe_subscription_id  TEXT,
  stripe_price_id         TEXT,

  -- Billing period
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  trial_ends_at           TIMESTAMPTZ,
  canceled_at             TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN     NOT NULL DEFAULT false,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, product)
);

CREATE INDEX idx_subscriptions_org ON shared.subscriptions(organization_id);
CREATE INDEX idx_subscriptions_active ON shared.subscriptions(organization_id, product) WHERE status IN ('trial', 'active');
CREATE INDEX idx_subscriptions_stripe ON shared.subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- ─── CROSS-APP EVENTS ──────────────────────────────────────────────────────────
-- Reliable event bus with retry logic and dead-letter queue.
-- Both products write events here; each product's cron processes its own.

CREATE TABLE shared.cross_app_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,

  -- Routing
  source_app        TEXT        NOT NULL CHECK (source_app IN ('ISYTASK', 'ISYSOCIAL')),
  target_app        TEXT        NOT NULL CHECK (target_app IN ('ISYTASK', 'ISYSOCIAL')),
  event_type        TEXT        NOT NULL,

  -- Processing state
  status            TEXT        NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'DEAD_LETTER')),

  -- Payload
  payload           JSONB       NOT NULL DEFAULT '{}',

  -- Error handling & retry
  error_message     TEXT,
  retry_count       INTEGER     NOT NULL DEFAULT 0,
  max_retries       INTEGER     NOT NULL DEFAULT 5,
  next_retry_at     TIMESTAMPTZ DEFAULT now(),

  -- Audit
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Efficient processing: fetch pending events ready for retry
CREATE INDEX idx_events_pending ON shared.cross_app_events(target_app, status, next_retry_at)
  WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX idx_events_org ON shared.cross_app_events(organization_id);
CREATE INDEX idx_events_dead ON shared.cross_app_events(status, created_at)
  WHERE status = 'DEAD_LETTER';

-- ─── SSO SESSIONS ──────────────────────────────────────────────────────────────
-- Cross-product authentication tokens for seamless product switching.

CREATE TABLE shared.sso_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  email             TEXT        NOT NULL,
  token             TEXT        NOT NULL UNIQUE,
  source_app        TEXT        NOT NULL CHECK (source_app IN ('ISYTASK', 'ISYSOCIAL')),

  -- User context passed to target app
  user_name         TEXT,
  user_role         TEXT,
  user_avatar_url   TEXT,

  -- Expiry (short-lived, 5 minutes max)
  expires_at        TIMESTAMPTZ NOT NULL,
  used_at           TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sso_token ON shared.sso_sessions(token) WHERE used_at IS NULL;
CREATE INDEX idx_sso_cleanup ON shared.sso_sessions(expires_at);

-- ─── HELPER FUNCTION: Updated At trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION shared.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON shared.organizations
  FOR EACH ROW EXECUTE FUNCTION shared.update_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON shared.subscriptions
  FOR EACH ROW EXECUTE FUNCTION shared.update_updated_at();

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON shared.cross_app_events
  FOR EACH ROW EXECUTE FUNCTION shared.update_updated_at();

-- ─── MIGRATE EXISTING DATA ─────────────────────────────────────────────────────
-- Create Organization records from existing Isytask agencies that have subscriptions.
-- This is safe to run multiple times (idempotent via ON CONFLICT).

INSERT INTO shared.organizations (name, slug, isytask_agency_id, stripe_customer_id)
SELECT
  a.name,
  LOWER(REPLACE(REPLACE(a.name, ' ', '-'), '.', '')),
  a.id,
  a."stripeCustomerId"
FROM public."Agency" a
WHERE a."isActive" = true
ON CONFLICT (isytask_agency_id) DO NOTHING;

-- Link Isysocial agencies by matching name
UPDATE shared.organizations o
SET isysocial_agency_id = ia.id
FROM isysocial.iso_agencies ia
WHERE LOWER(TRIM(o.name)) = LOWER(TRIM(ia.name))
  AND o.isysocial_agency_id IS NULL;

-- Migrate existing subscriptions from Isytask's public schema to shared
INSERT INTO shared.subscriptions (
  organization_id, product, plan_tier, status,
  stripe_subscription_id, stripe_price_id,
  current_period_start, current_period_end,
  trial_ends_at, canceled_at, created_at
)
SELECT
  o.id,
  s.product::text,
  s."planTier",
  s.status,
  s."stripeSubscriptionId",
  s."stripePriceId",
  s."currentPeriodStart",
  s."currentPeriodEnd",
  s."trialEndsAt",
  s."canceledAt",
  s."createdAt"
FROM public."Subscription" s
JOIN shared.organizations o ON o.isytask_agency_id = s."agencyId"
ON CONFLICT (organization_id, product) DO UPDATE SET
  plan_tier = EXCLUDED.plan_tier,
  status = EXCLUDED.status,
  stripe_subscription_id = EXCLUDED.stripe_subscription_id,
  updated_at = now();

-- ─── GRANT PERMISSIONS ──────────────────────────────────────────────────────────
-- Both apps connect with the same Supabase role, so they can read/write shared.

GRANT USAGE ON SCHEMA shared TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA shared TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA shared TO authenticated;
