-- Add missing outcomeAt column to tasks table
-- This column was in the Prisma schema but missed in the original migration.
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "outcomeAt" TIMESTAMPTZ;
