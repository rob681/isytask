import { PrismaClient } from "../../../apps/web/generated/prisma";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create admin user
  const adminPassword = await hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@isytask.com" },
    update: {},
    create: {
      email: "admin@isytask.com",
      passwordHash: adminPassword,
      name: "Administrador",
      role: "ADMIN",
      phone: "+521234567890",
    },
  });
  console.log("✅ Admin creado:", admin.email);

  // Create team members
  const teamPassword = await hash("equipo123", 12);
  const colaborador1 = await prisma.user.upsert({
    where: { email: "eduardo@isytask.com" },
    update: {},
    create: {
      email: "eduardo@isytask.com",
      passwordHash: teamPassword,
      name: "Lic. Eduardo Viramontes",
      role: "COLABORADOR",
      phone: "+521234567891",
      colaboradorProfile: {
        create: { specialty: "Diseño Web" },
      },
    },
  });

  const colaborador2 = await prisma.user.upsert({
    where: { email: "maria@isytask.com" },
    update: {},
    create: {
      email: "maria@isytask.com",
      passwordHash: teamPassword,
      name: "María García",
      role: "COLABORADOR",
      phone: "+521234567892",
      colaboradorProfile: {
        create: { specialty: "Diseño Gráfico" },
      },
    },
  });
  console.log("✅ Equipo creado:", colaborador1.email, colaborador2.email);

  // Create clients
  const clientPassword = await hash("cliente123", 12);
  const client1 = await prisma.user.upsert({
    where: { email: "contacto@qubitoz.com" },
    update: {},
    create: {
      email: "contacto@qubitoz.com",
      passwordHash: clientPassword,
      name: "Juan Pérez",
      role: "CLIENTE",
      phone: "+521234567893",
      clientProfile: {
        create: {
          companyName: "Qubitoz",
          monthlyTaskLimit: 10,
          revisionLimitPerTask: 3,
        },
      },
    },
  });

  const client2 = await prisma.user.upsert({
    where: { email: "info@techcorp.com" },
    update: {},
    create: {
      email: "info@techcorp.com",
      passwordHash: clientPassword,
      name: "Ana López",
      role: "CLIENTE",
      phone: "+521234567894",
      clientProfile: {
        create: {
          companyName: "TechCorp",
          monthlyTaskLimit: 15,
          revisionLimitPerTask: 5,
        },
      },
    },
  });
  console.log("✅ Clientes creados:", client1.email, client2.email);

  // Create services
  const webDesign = await prisma.service.upsert({
    where: { name: "Diseño de página web" },
    update: {},
    create: {
      name: "Diseño de página web",
      description: "Diseño completo de sitio web responsive",
      estimatedHours: 120,
      formFields: {
        create: [
          {
            fieldName: "num_pestanas",
            label: "Número de pestañas",
            fieldType: "NUMBER",
            placeholder: "Ej: 5",
            isRequired: true,
            sortOrder: 0,
            validation: { min: 1, max: 20 },
          },
          {
            fieldName: "nombre_pestanas",
            label: "Nombre de las pestañas",
            fieldType: "TEXTAREA",
            placeholder: "Ej: Inicio, Nosotros, Servicios, Blog, Contacto",
            isRequired: true,
            sortOrder: 1,
          },
          {
            fieldName: "contenido_pestanas",
            label: "Descripción del contenido por pestaña",
            fieldType: "TEXTAREA",
            placeholder: "Describe el contenido que deseas en cada pestaña...",
            isRequired: true,
            sortOrder: 2,
          },
          {
            fieldName: "referencia_web",
            label: "Sitios web de referencia",
            fieldType: "URL",
            placeholder: "https://ejemplo.com",
            isRequired: false,
            sortOrder: 3,
          },
          {
            fieldName: "colores_preferidos",
            label: "Colores de tu marca",
            fieldType: "COLOR_PICKER",
            isRequired: false,
            sortOrder: 4,
          },
        ],
      },
    },
  });

  const logoDesign = await prisma.service.upsert({
    where: { name: "Diseño de logotipo" },
    update: {},
    create: {
      name: "Diseño de logotipo",
      description: "Diseño de logotipo profesional con manual de marca",
      estimatedHours: 40,
      formFields: {
        create: [
          {
            fieldName: "nombre_empresa",
            label: "Nombre de la empresa/marca",
            fieldType: "TEXT",
            placeholder: "Nombre que aparecerá en el logo",
            isRequired: true,
            sortOrder: 0,
          },
          {
            fieldName: "slogan",
            label: "Slogan (opcional)",
            fieldType: "TEXT",
            placeholder: "Tu slogan o frase",
            isRequired: false,
            sortOrder: 1,
          },
          {
            fieldName: "estilo",
            label: "Estilo preferido",
            fieldType: "SELECT",
            isRequired: true,
            sortOrder: 2,
            options: ["Minimalista", "Moderno", "Clásico", "Divertido", "Corporativo"],
          },
          {
            fieldName: "colores",
            label: "Colores preferidos",
            fieldType: "COLOR_PICKER",
            isRequired: false,
            sortOrder: 3,
          },
          {
            fieldName: "descripcion_negocio",
            label: "Descripción del negocio",
            fieldType: "TEXTAREA",
            placeholder: "¿A qué se dedica tu empresa?",
            isRequired: true,
            sortOrder: 4,
          },
        ],
      },
    },
  });

  const socialMedia = await prisma.service.upsert({
    where: { name: "Diseño para redes sociales" },
    update: {},
    create: {
      name: "Diseño para redes sociales",
      description: "Diseño de contenido para redes sociales",
      estimatedHours: 8,
      formFields: {
        create: [
          {
            fieldName: "red_social",
            label: "Red social",
            fieldType: "MULTISELECT",
            isRequired: true,
            sortOrder: 0,
            options: ["Instagram", "Facebook", "TikTok", "LinkedIn", "X (Twitter)"],
          },
          {
            fieldName: "tipo_contenido",
            label: "Tipo de contenido",
            fieldType: "SELECT",
            isRequired: true,
            sortOrder: 1,
            options: ["Post estático", "Carrusel", "Historia", "Reel/Video", "Banner"],
          },
          {
            fieldName: "texto_contenido",
            label: "Texto o copy del contenido",
            fieldType: "TEXTAREA",
            placeholder: "¿Qué debe decir la publicación?",
            isRequired: true,
            sortOrder: 2,
          },
          {
            fieldName: "cantidad",
            label: "Cantidad de diseños",
            fieldType: "NUMBER",
            isRequired: true,
            sortOrder: 3,
            validation: { min: 1, max: 30 },
          },
        ],
      },
    },
  });
  console.log("✅ Servicios creados:", webDesign.name, logoDesign.name, socialMedia.name);

  // Assign colaboradores to clients
  const colab1Profile = await prisma.colaboradorProfile.findUnique({
    where: { userId: colaborador1.id },
  });
  const colab2Profile = await prisma.colaboradorProfile.findUnique({
    where: { userId: colaborador2.id },
  });
  const client1Profile = await prisma.clientProfile.findUnique({
    where: { userId: client1.id },
  });
  const client2Profile = await prisma.clientProfile.findUnique({
    where: { userId: client2.id },
  });

  if (colab1Profile && client1Profile) {
    await prisma.colaboradorClientAssignment.upsert({
      where: {
        colaboradorId_clientId: {
          colaboradorId: colab1Profile.id,
          clientId: client1Profile.id,
        },
      },
      update: {},
      create: {
        colaboradorId: colab1Profile.id,
        clientId: client1Profile.id,
      },
    });
  }

  if (colab2Profile && client2Profile) {
    await prisma.colaboradorClientAssignment.upsert({
      where: {
        colaboradorId_clientId: {
          colaboradorId: colab2Profile.id,
          clientId: client2Profile.id,
        },
      },
      update: {},
      create: {
        colaboradorId: colab2Profile.id,
        clientId: client2Profile.id,
      },
    });
  }
  console.log("✅ Asignaciones de equipo creadas");

  // Create sample tasks
  if (client1Profile && colab1Profile) {
    await prisma.task.create({
      data: {
        clientId: client1Profile.id,
        serviceId: webDesign.id,
        colaboradorId: colab1Profile.id,
        title: "Diseño de página web - Qubitoz",
        category: "NORMAL",
        status: "EN_PROGRESO",
        estimatedHours: 72,
        revisionsLimit: 3,
        startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        formData: {
          num_pestanas: 5,
          nombre_pestanas: "Inicio, Nosotros, Servicios, Blog, Contacto",
          contenido_pestanas: "Página principal con slider, sección de servicios destacados...",
          referencia_web: "https://ejemplo.com",
        },
        statusLog: {
          create: [
            {
              fromStatus: null,
              toStatus: "RECIBIDA",
              changedById: client1.id,
              note: "Tarea creada",
            },
            {
              fromStatus: "RECIBIDA",
              toStatus: "EN_PROGRESO",
              changedById: colaborador1.id,
              note: "Iniciando diseño",
            },
          ],
        },
      },
    });

    await prisma.task.create({
      data: {
        clientId: client1Profile.id,
        serviceId: socialMedia.id,
        title: "Post para Instagram - Qubitoz",
        category: "URGENTE",
        status: "RECIBIDA",
        estimatedHours: 4,
        revisionsLimit: 3,
        formData: {
          red_social: ["Instagram"],
          tipo_contenido: "Carrusel",
          texto_contenido: "Promoción de fin de año para nuestros servicios",
          cantidad: 3,
        },
        statusLog: {
          create: {
            fromStatus: null,
            toStatus: "RECIBIDA",
            changedById: client1.id,
            note: "Tarea creada",
          },
        },
      },
    });
  }

  if (client2Profile) {
    await prisma.task.create({
      data: {
        clientId: client2Profile.id,
        serviceId: logoDesign.id,
        title: "Logotipo para TechCorp",
        category: "NORMAL",
        status: "RECIBIDA",
        estimatedHours: 40,
        revisionsLimit: 5,
        formData: {
          nombre_empresa: "TechCorp",
          slogan: "Innovación sin límites",
          estilo: "Moderno",
          descripcion_negocio: "Empresa de desarrollo de software y consultoría tecnológica",
        },
        statusLog: {
          create: {
            fromStatus: null,
            toStatus: "RECIBIDA",
            changedById: client2.id,
            note: "Tarea creada",
          },
        },
      },
    });
  }
  console.log("✅ Tareas de ejemplo creadas");

  console.log("\n🎉 Seed completado!");
  console.log("\n📋 Credenciales de prueba:");
  console.log("  Admin:       admin@isytask.com / admin123");
  console.log("  Colaborador: eduardo@isytask.com / equipo123");
  console.log("  Colaborador: maria@isytask.com / equipo123");
  console.log("  Cliente:     contacto@qubitoz.com / cliente123");
  console.log("  Cliente:     info@techcorp.com / cliente123");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
