-- ──────────────────────────────────────────────────────────────────────────────
-- Security: Account Lockout + MFA fields
-- ──────────────────────────────────────────────────────────────────────────────

-- Account lockout: track failed login attempts
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "loginAttempts"  INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil"    TIMESTAMP;

-- MFA / TOTP: optional two-factor auth for admins
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "mfaEnabled"  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "totpSecret"  TEXT;          -- encrypted TOTP secret

-- ──────────────────────────────────────────────────────────────────────────────
-- Audit Log: immutable log of sensitive user/system actions
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "agencyId"   TEXT,
  "userId"     TEXT,                         -- who performed the action (nullable = system)
  "action"     TEXT NOT NULL,               -- e.g. USER_LOGIN, TASK_STATUS_CHANGED
  "entityType" TEXT,                        -- e.g. Task, User, Post
  "entityId"   TEXT,                        -- PK of the affected record
  "oldValue"   JSONB,                       -- before state (for updates)
  "newValue"   JSONB,                       -- after state
  "ipAddress"  TEXT,
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "audit_logs_agencyId_idx"  ON "audit_logs"("agencyId");
CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx"    ON "audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx"    ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- Add MFA_SETUP to TokenType enum
ALTER TYPE "TokenType" ADD VALUE IF NOT EXISTS 'MFA_SETUP';
