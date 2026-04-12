CREATE TABLE IF NOT EXISTS "recurring_task_assignments" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "recurringTaskId" TEXT NOT NULL,
  "colaboradorId"   TEXT NOT NULL,
  "role"            TEXT NOT NULL DEFAULT 'HELPER',
  "createdAt"       TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "rta_recurringTaskId_fkey"
    FOREIGN KEY ("recurringTaskId") REFERENCES "recurring_tasks"("id") ON DELETE CASCADE,
  CONSTRAINT "rta_colaboradorId_fkey"
    FOREIGN KEY ("colaboradorId") REFERENCES "colaborador_profiles"("id"),
  CONSTRAINT "rta_unique" UNIQUE ("recurringTaskId", "colaboradorId")
);
CREATE INDEX IF NOT EXISTS "rta_recurringTaskId_idx" ON "recurring_task_assignments"("recurringTaskId");
