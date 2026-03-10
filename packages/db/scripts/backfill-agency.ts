/**
 * Backfill script: Create default Agency and assign all existing data to it.
 *
 * Run with: npx tsx packages/db/scripts/backfill-agency.ts
 */

import { PrismaClient } from "../../../apps/web/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting agency backfill...\n");

  // 1. Create (or find) the default agency
  const agency = await prisma.agency.upsert({
    where: { slug: "default" },
    create: { name: "Agencia Principal", slug: "default" },
    update: {},
  });
  console.log(`Agency: "${agency.name}" (${agency.id})\n`);

  // 2. Backfill all models where agencyId IS NULL
  const [users, services, tasks, recurring, templates] = await Promise.all([
    prisma.user.updateMany({
      where: { agencyId: null },
      data: { agencyId: agency.id },
    }),
    prisma.service.updateMany({
      where: { agencyId: null },
      data: { agencyId: agency.id },
    }),
    prisma.task.updateMany({
      where: { agencyId: null },
      data: { agencyId: agency.id },
    }),
    prisma.recurringTask.updateMany({
      where: { agencyId: null },
      data: { agencyId: agency.id },
    }),
    prisma.taskTemplate.updateMany({
      where: { agencyId: null },
      data: { agencyId: agency.id },
    }),
  ]);

  console.log("Backfill results:");
  console.log(`  Users:          ${users.count} updated`);
  console.log(`  Services:       ${services.count} updated`);
  console.log(`  Tasks:          ${tasks.count} updated`);
  console.log(`  RecurringTasks: ${recurring.count} updated`);
  console.log(`  TaskTemplates:  ${templates.count} updated`);
  console.log("\nDone! All data assigned to agency:", agency.id);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
