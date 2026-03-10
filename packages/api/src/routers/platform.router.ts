import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  superAdminProcedure,
  soporteProcedure,
  facturacionProcedure,
  ventasProcedure,
  analistaProcedure,
} from "../trpc";
import { createPlatformStaffSchema } from "@isytask/shared";
import { createToken } from "../lib/tokens";
import { sendEmailNotification } from "../lib/email";

export const platformRouter = router({
  // ═══════════════════════════════════════════
  // STAFF MANAGEMENT (SUPER_ADMIN only)
  // ═══════════════════════════════════════════

  listStaff: superAdminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        role: z.enum(["SOPORTE", "FACTURACION", "VENTAS", "ANALISTA"]).optional(),
      }).optional().default({})
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        agencyId: null,
        role: input.role
          ? input.role
          : { in: ["SOPORTE", "FACTURACION", "VENTAS", "ANALISTA"] },
      };
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
        ];
      }
      const users = await ctx.db.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, role: true,
          isActive: true, createdAt: true, passwordHash: true,
        },
        orderBy: { createdAt: "desc" },
      });
      return users.map(({ passwordHash, ...u }) => ({
        ...u,
        hasPassword: !!passwordHash,
      }));
    }),

  createStaff: superAdminProcedure
    .input(createPlatformStaffSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Email ya registrado." });
      }
      const user = await ctx.db.user.create({
        data: {
          email: input.email,
          name: input.name,
          role: input.role as any,
          agencyId: undefined,
        },
        select: { id: true, email: true, name: true, role: true },
      });

      const tokenString = await createToken(ctx.db, user.id, "INVITATION");
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const invitationUrl = `${baseUrl}/setup-password?token=${tokenString}`;

      await sendEmailNotification({
        db: ctx.db,
        to: user.email,
        subject: "Invitacion a Isytask — Staff de plataforma",
        title: "Bienvenido al equipo de Isytask",
        body: `Hola ${user.name},<br><br>Has sido invitado como <strong>${user.role}</strong> en la plataforma Isytask. Haz clic para configurar tu contrasena.<br><br>Este enlace expira en 48 horas.`,
        actionUrl: invitationUrl,
        actionLabel: "Configurar mi contrasena",
      }).catch((err) => {
        console.error("[Platform Staff] Email failed:", err);
      });

      return user;
    }),

  toggleStaffActive: superAdminProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({ where: { id: input.id } });
      if (user.agencyId !== null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No es un usuario de plataforma." });
      }
      return ctx.db.user.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
        select: { id: true, isActive: true, name: true },
      });
    }),

  deleteStaff: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({ where: { id: input.id } });
      if (user.role === "SUPER_ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "No se puede eliminar un super admin." });
      }
      if (user.agencyId !== null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No es un usuario de plataforma." });
      }
      return ctx.db.user.delete({ where: { id: input.id } });
    }),

  // ═══════════════════════════════════════════
  // SOPORTE endpoints
  // ═══════════════════════════════════════════

  soporteDashboard: soporteProcedure.query(async ({ ctx }) => {
    const [totalAgencies, activeAgencies, totalUsers, inactiveUsers, recentAgencies] =
      await Promise.all([
        ctx.db.agency.count(),
        ctx.db.agency.count({ where: { isActive: true } }),
        ctx.db.user.count({ where: { agencyId: { not: null } } }),
        ctx.db.user.count({ where: { agencyId: { not: null }, isActive: false } }),
        ctx.db.agency.findMany({
          orderBy: { updatedAt: "desc" },
          take: 10,
          select: {
            id: true, name: true, slug: true, isActive: true, updatedAt: true,
            _count: { select: { users: true, tasks: true } },
          },
        }),
      ]);
    return { totalAgencies, activeAgencies, totalUsers, inactiveUsers, recentAgencies };
  }),

  soporteAgencies: soporteProcedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }).optional().default({})
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { slug: { contains: input.search, mode: "insensitive" } },
        ];
      }
      const [agencies, total] = await Promise.all([
        ctx.db.agency.findMany({
          where,
          include: { _count: { select: { users: true, tasks: true } } },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.agency.count({ where }),
      ]);
      return { agencies, total, page: input.page, totalPages: Math.ceil(total / input.pageSize) };
    }),

  soporteUsers: soporteProcedure
    .input(
      z.object({
        search: z.string().optional(),
        agencyId: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }).optional().default({})
    )
    .query(async ({ ctx, input }) => {
      const where: any = { agencyId: { not: null } };
      if (input.agencyId) where.agencyId = input.agencyId;
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
        ];
      }
      const [users, total] = await Promise.all([
        ctx.db.user.findMany({
          where,
          select: {
            id: true, email: true, name: true, role: true,
            isActive: true, agencyId: true, createdAt: true,
            agency: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.user.count({ where }),
      ]);
      return { users, total, page: input.page, totalPages: Math.ceil(total / input.pageSize) };
    }),

  soporteToggleUser: soporteProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
        select: { id: true, isActive: true, name: true },
      });
    }),

  // ═══════════════════════════════════════════
  // FACTURACION endpoints
  // ═══════════════════════════════════════════

  facturacionDashboard: facturacionProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const [byPlan, totalAgencies, trialCount, expiringSoon] = await Promise.all([
      ctx.db.agency.groupBy({ by: ["planTier"], _count: { id: true } }),
      ctx.db.agency.count(),
      ctx.db.agency.count({ where: { trialEndsAt: { not: null, gt: now } } }),
      ctx.db.agency.findMany({
        where: {
          trialEndsAt: {
            not: null,
            gt: now,
            lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: { id: true, name: true, trialEndsAt: true, planTier: true },
        orderBy: { trialEndsAt: "asc" },
      }),
    ]);
    return {
      planDistribution: byPlan.map((p) => ({ plan: p.planTier, count: p._count.id })),
      totalAgencies,
      activeTrials: trialCount,
      expiringSoon,
    };
  }),

  facturacionAgencies: facturacionProcedure
    .input(
      z.object({
        search: z.string().optional(),
        planTier: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }).optional().default({})
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { billingEmail: { contains: input.search, mode: "insensitive" } },
        ];
      }
      if (input.planTier) where.planTier = input.planTier;
      const [agencies, total] = await Promise.all([
        ctx.db.agency.findMany({
          where,
          select: {
            id: true, name: true, slug: true, planTier: true,
            maxUsers: true, billingEmail: true, trialEndsAt: true,
            isActive: true, createdAt: true,
            _count: { select: { users: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.agency.count({ where }),
      ]);
      return { agencies, total, page: input.page, totalPages: Math.ceil(total / input.pageSize) };
    }),

  facturacionUpdateAgency: facturacionProcedure
    .input(
      z.object({
        id: z.string(),
        planTier: z.string().optional(),
        maxUsers: z.number().int().min(1).optional(),
        billingEmail: z.string().email().optional().nullable(),
        trialEndsAt: z.string().datetime().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, trialEndsAt, ...data } = input;
      return ctx.db.agency.update({
        where: { id },
        data: {
          ...data,
          ...(trialEndsAt !== undefined && {
            trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
          }),
        },
      });
    }),

  // ═══════════════════════════════════════════
  // VENTAS endpoints
  // ═══════════════════════════════════════════

  ventasDashboard: ventasProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [totalAgencies, recentSignups, activeTrials, trialExpiringSoon, recentAgencies] =
      await Promise.all([
        ctx.db.agency.count(),
        ctx.db.agency.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        ctx.db.agency.count({ where: { trialEndsAt: { not: null, gt: now } } }),
        ctx.db.agency.findMany({
          where: {
            trialEndsAt: {
              not: null,
              gt: now,
              lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            },
          },
          select: { id: true, name: true, trialEndsAt: true, planTier: true, createdAt: true },
          orderBy: { trialEndsAt: "asc" },
        }),
        ctx.db.agency.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: {
            id: true, name: true, planTier: true, createdAt: true,
            trialEndsAt: true,
            _count: { select: { users: true, tasks: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ]);
    return { totalAgencies, recentSignups, activeTrials, trialExpiringSoon, recentAgencies };
  }),

  ventasMonthlySignups: ventasProcedure
    .input(z.object({ year: z.number().int().default(new Date().getFullYear()) }).optional().default({}))
    .query(async ({ ctx, input }) => {
      const agencies = await ctx.db.agency.findMany({
        where: {
          createdAt: { gte: new Date(input.year, 0, 1), lt: new Date(input.year + 1, 0, 1) },
        },
        select: { createdAt: true },
      });
      const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0 }));
      agencies.forEach((a) => { months[a.createdAt.getMonth()].count++; });
      return months;
    }),

  // ═══════════════════════════════════════════
  // ANALISTA endpoints
  // ═══════════════════════════════════════════

  analistaDashboard: analistaProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [
      totalAgencies, activeAgencies, totalUsers, totalTasks, totalServices,
      tasksByStatus, newAgencies30d, newUsers30d, newTasks30d, byPlan,
    ] = await Promise.all([
      ctx.db.agency.count(),
      ctx.db.agency.count({ where: { isActive: true } }),
      ctx.db.user.count({ where: { role: { notIn: ["SUPER_ADMIN", "SOPORTE", "FACTURACION", "VENTAS", "ANALISTA"] } } }),
      ctx.db.task.count(),
      ctx.db.service.count(),
      ctx.db.task.groupBy({ by: ["status"], _count: { id: true } }),
      ctx.db.agency.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      ctx.db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      ctx.db.task.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      ctx.db.agency.groupBy({ by: ["planTier"], _count: { id: true } }),
    ]);
    return {
      totalAgencies, activeAgencies, totalUsers, totalTasks, totalServices,
      tasksByStatus: tasksByStatus.map((r) => ({ status: r.status, count: r._count.id })),
      growth: { newAgencies30d, newUsers30d, newTasks30d },
      planDistribution: byPlan.map((p) => ({ plan: p.planTier, count: p._count.id })),
    };
  }),

  analistaMonthlyTrends: analistaProcedure
    .input(z.object({ year: z.number().int().default(new Date().getFullYear()) }).optional().default({}))
    .query(async ({ ctx, input }) => {
      const [agencies, users, tasks] = await Promise.all([
        ctx.db.agency.findMany({
          where: { createdAt: { gte: new Date(input.year, 0, 1), lt: new Date(input.year + 1, 0, 1) } },
          select: { createdAt: true },
        }),
        ctx.db.user.findMany({
          where: { createdAt: { gte: new Date(input.year, 0, 1), lt: new Date(input.year + 1, 0, 1) } },
          select: { createdAt: true },
        }),
        ctx.db.task.findMany({
          where: { createdAt: { gte: new Date(input.year, 0, 1), lt: new Date(input.year + 1, 0, 1) } },
          select: { createdAt: true },
        }),
      ]);
      const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1, agencies: 0, users: 0, tasks: 0,
      }));
      agencies.forEach((a) => { months[a.createdAt.getMonth()].agencies++; });
      users.forEach((u) => { months[u.createdAt.getMonth()].users++; });
      tasks.forEach((t) => { months[t.createdAt.getMonth()].tasks++; });
      return months;
    }),

  analistaTopAgencies: analistaProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).optional().default({}))
    .query(async ({ ctx, input }) => {
      return ctx.db.agency.findMany({
        where: { isActive: true },
        select: {
          id: true, name: true, slug: true, planTier: true, createdAt: true,
          _count: { select: { users: true, tasks: true, services: true } },
        },
        orderBy: { tasks: { _count: "desc" } },
        take: input.limit,
      });
    }),
});
