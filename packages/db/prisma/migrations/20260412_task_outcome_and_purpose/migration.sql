-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2: Task outcome fields + purpose context field
-- ─────────────────────────────────────────────────────────────────────────────

-- Purpose: optional free-text context explaining why a task was created.
-- Feeds future agent memory. Never required, never visible to the end client.
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "purpose" TEXT;

-- Outcome: written at FINALIZADA, captures what was actually delivered
-- and a 1-5 satisfaction rating from the team.
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "outcomeNote"   TEXT,
  ADD COLUMN IF NOT EXISTS "outcomeRating" INTEGER;
