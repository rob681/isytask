-- ──────────────────────────────────────────────────────────────────────────────
-- Email Verification + Rate Limit table
-- ──────────────────────────────────────────────────────────────────────────────

-- Add EMAIL_VERIFICATION to TokenType enum
ALTER TYPE "TokenType" ADD VALUE IF NOT EXISTS 'EMAIL_VERIFICATION';

-- Email verification fields on users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "emailVerified"   BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP;

-- Existing ADMIN users (created before this feature) are considered verified
UPDATE "users"
SET "emailVerified" = TRUE, "emailVerifiedAt" = NOW()
WHERE "emailVerified" = FALSE;

-- ──────────────────────────────────────────────────────────────────────────────
-- Rate Limit Records — DB-backed, survives server restarts
-- Replaces in-memory Maps in auth.router.ts
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "rate_limit_records" (
  "id"        TEXT    NOT NULL PRIMARY KEY,
  "key"       TEXT    NOT NULL,   -- e.g. "reset:<email>", "register:<email>"
  "count"     INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "rate_limit_records_key_idx" ON "rate_limit_records"("key");
CREATE INDEX IF NOT EXISTS "rate_limit_records_expires_idx" ON "rate_limit_records"("expiresAt");
