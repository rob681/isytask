/**
 * One-time script to create the SUPER_ADMIN user.
 * Run: npx tsx packages/db/scripts/create-super-admin.ts
 */
import { PrismaClient } from "../../../apps/web/generated/prisma";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || "super@isytask.com";
  const password = process.env.SUPER_ADMIN_PASSWORD || "super123";
  const name = process.env.SUPER_ADMIN_NAME || "Super Administrador";

  console.log(`Creating SUPER_ADMIN user: ${email}`);

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: "SUPER_ADMIN",
      passwordHash,
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      name,
      role: "SUPER_ADMIN",
      // No agencyId — platform-level user
    },
  });

  console.log(`✅ Super admin created/updated:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   AgencyId: ${user.agencyId ?? "(none — platform level)"}`);
  console.log(`\n   Login: ${email} / ${password}`);
}

main()
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
