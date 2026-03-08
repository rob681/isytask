-- Add REVISION to TaskStatus enum
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'REVISION';

-- Add RecurrenceType enum
DO $$ BEGIN
  CREATE TYPE "RecurrenceType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add TAREA_EN_REVISION and SLA_ALERTA to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TAREA_EN_REVISION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SLA_ALERTA';

-- Add slaHours to services
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "slaHours" INTEGER;

-- Create recurring_tasks table
CREATE TABLE IF NOT EXISTS "recurring_tasks" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskCategory" NOT NULL DEFAULT 'NORMAL',
    "formData" JSONB,
    "recurrenceType" "RecurrenceType" NOT NULL,
    "recurrenceDay" INTEGER,
    "recurrenceTime" TEXT NOT NULL DEFAULT '09:00',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_tasks_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys for recurring_tasks
DO $$ BEGIN
  ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for recurring_tasks
CREATE INDEX IF NOT EXISTS "recurring_tasks_isActive_nextRunAt_idx" ON "recurring_tasks"("isActive", "nextRunAt");
