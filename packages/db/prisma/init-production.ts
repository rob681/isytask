/**
 * Production initialization script.
 * Creates only the initial admin user with a secure password.
 *
 * Usage:
 *   pnpm db:init -- --email admin@tudominio.com --password TuPasswordSeguro123!
 *
 * Or with environment variables:
 *   ADMIN_EMAIL=admin@tudominio.com ADMIN_PASSWORD=TuPasswordSeguro123! pnpm db:init
 */
import { PrismaClient } from "../generated/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

function getArgs() {
  const args = process.argv.slice(2);
  let email = process.env.ADMIN_EMAIL || "";
  let password = process.env.ADMIN_PASSWORD || "";
  let name = process.env.ADMIN_NAME || "Administrador";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) email = args[i + 1];
    if (args[i] === "--password" && args[i + 1]) password = args[i + 1];
    if (args[i] === "--name" && args[i + 1]) name = args[i + 1];
  }

  return { email, password, name };
}

async function main() {
  const { email, password, name } = getArgs();

  if (!email || !password) {
    console.error("\n❌ Error: Se requiere email y password del admin.\n");
    console.error("Uso:");
    console.error("  pnpm db:init -- --email admin@tudominio.com --password MiPassword123!\n");
    console.error("O con variables de entorno:");
    console.error("  ADMIN_EMAIL=admin@tudominio.com ADMIN_PASSWORD=MiPassword123! pnpm db:init\n");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("\n❌ Error: La contraseña debe tener al menos 8 caracteres.\n");
    process.exit(1);
  }

  console.log("\n🚀 Inicializando Isytask para producción...\n");

  // Check if any admin exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (existingAdmin) {
    console.log(`⚠️  Ya existe un admin: ${existingAdmin.email}`);
    console.log("   Si deseas crear otro, usa el panel de administración.\n");
    return;
  }

  // Create admin
  const passwordHash = await hash(password, 12);
  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role: "ADMIN",
    },
  });

  console.log(`✅ Admin creado: ${admin.email}`);
  console.log(`   Nombre: ${admin.name}`);
  console.log(`\n📋 Siguiente paso:`);
  console.log(`   1. Inicia sesión en tu dominio con estas credenciales`);
  console.log(`   2. Ve a Configuración para personalizar tu empresa`);
  console.log(`   3. Agrega servicios, colaboradores y clientes desde el panel\n`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
