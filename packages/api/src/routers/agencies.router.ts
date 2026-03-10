import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { superAdminProcedure, router } from "../trpc";
import { createAgencySchema, updateAgencySchema } from "@isytask/shared";
import { createToken } from "../lib/tokens";
import { sendEmailNotification } from "../lib/email";

export const agenciesRouter = router({
  /** List all agencies with pagination, search, and counts */
  list: superAdminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
        isActive: z.boolean().optional(),
      }).optional().default({})
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, isActive } = input;
      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ];
      }
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const [agencies, total] = await Promise.all([
        ctx.db.agency.findMany({
          where,
          include: {
            _count: { select: { users: true, tasks: true, services: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        ctx.db.agency.count({ where }),
      ]);

      return {
        agencies,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  /** Get single agency with details */
  getById: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.agency.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          users: {
            where: { role: "ADMIN" },
            select: { id: true, email: true, name: true, isActive: true, passwordHash: true },
          },
          _count: { select: { users: true, tasks: true, services: true } },
        },
      });
    }),

  /** Create agency + first admin user with invitation */
  create: superAdminProcedure
    .input(createAgencySchema)
    .mutation(async ({ ctx, input }) => {
      // Check slug uniqueness
      const existingSlug = await ctx.db.agency.findUnique({ where: { slug: input.slug } });
      if (existingSlug) {
        throw new TRPCError({ code: "CONFLICT", message: "El slug ya está en uso." });
      }

      // Check admin email uniqueness
      const existingUser = await ctx.db.user.findUnique({ where: { email: input.adminEmail } });
      if (existingUser) {
        throw new TRPCError({ code: "CONFLICT", message: "El email del admin ya está registrado." });
      }

      // Transaction: create agency + first admin user
      const result = await ctx.db.$transaction(async (tx: any) => {
        const agency = await tx.agency.create({
          data: {
            name: input.name,
            slug: input.slug,
            logoUrl: input.logoUrl,
            maxUsers: input.maxUsers,
            planTier: input.planTier,
            billingEmail: input.billingEmail,
          },
        });

        const adminUser = await tx.user.create({
          data: {
            email: input.adminEmail,
            name: input.adminName,
            role: "ADMIN",
            agencyId: agency.id,
          },
        });

        return { agency, adminUser };
      });

      // Generate invitation token and send email
      const tokenString = await createToken(ctx.db, result.adminUser.id, "INVITATION");
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const invitationUrl = `${baseUrl}/auth/setup-password?token=${tokenString}`;

      await sendEmailNotification({
        db: ctx.db,
        to: input.adminEmail,
        subject: "Bienvenido a Isytask — Configura tu agencia",
        title: "Tu agencia ha sido creada",
        body: `Hola ${input.adminName},<br><br>Tu agencia <strong>${input.name}</strong> ha sido creada en Isytask. Haz clic en el botón de abajo para configurar tu contraseña y comenzar.<br><br>Este enlace expira en 48 horas.`,
        actionUrl: invitationUrl,
        actionLabel: "Configurar mi contraseña",
      }).catch((err) => {
        console.error("[Agency Invitation] Email failed:", err);
      });

      return result;
    }),

  /** Update agency details */
  update: superAdminProcedure
    .input(updateAgencySchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // If slug changed, check uniqueness
      if (data.slug) {
        const existing = await ctx.db.agency.findFirst({
          where: { slug: data.slug, id: { not: id } },
        });
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "El slug ya está en uso." });
        }
      }

      return ctx.db.agency.update({ where: { id }, data });
    }),

  /** Toggle agency active status */
  toggleActive: superAdminProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.agency.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
    }),

  /** Platform-wide statistics for super admin dashboard */
  platformStats: superAdminProcedure.query(async ({ ctx }) => {
    const [totalAgencies, activeAgencies, totalUsers, totalTasks, totalServices] =
      await Promise.all([
        ctx.db.agency.count(),
        ctx.db.agency.count({ where: { isActive: true } }),
        ctx.db.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
        ctx.db.task.count(),
        ctx.db.service.count(),
      ]);

    // Tasks by status across all agencies
    const tasksByStatus = await ctx.db.task.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    // Top agencies by task count
    const topAgencies = await ctx.db.agency.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        planTier: true,
        createdAt: true,
        _count: { select: { users: true, tasks: true, services: true } },
      },
      orderBy: { tasks: { _count: "desc" } },
      take: 10,
    });

    return {
      totalAgencies,
      activeAgencies,
      totalUsers,
      totalTasks,
      totalServices,
      tasksByStatus: tasksByStatus.map((r) => ({
        status: r.status,
        count: r._count.id,
      })),
      topAgencies,
    };
  }),
});
