/**
 * Backfill script: Creates TaskAssignment rows for all existing tasks
 * that have a colaboradorId set.
 *
 * Usage: pnpm --filter @isytask/db exec tsx prisma/backfill-assignments.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🔄 Backfilling TaskAssignment from existing tasks...");

  const tasks = await db.task.findMany({
    where: { colaboradorId: { not: null } },
    select: { id: true, colaboradorId: true },
  });

  console.log(`   Found ${tasks.length} tasks with a collaborator assigned.`);

  let created = 0;
  let skipped = 0;

  for (const task of tasks) {
    try {
      await db.taskAssignment.upsert({
        where: {
          taskId_colaboradorId: {
            taskId: task.id,
            colaboradorId: task.colaboradorId!,
          },
        },
        create: {
          taskId: task.id,
          colaboradorId: task.colaboradorId!,
          role: "PRIMARY",
        },
        update: {}, // Already exists, skip
      });
      created++;
    } catch (error) {
      console.error(`   ⚠ Failed for task ${task.id}:`, error);
      skipped++;
    }
  }

  console.log(`✅ Done. Created: ${created}, Skipped/Errors: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
