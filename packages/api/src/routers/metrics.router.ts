import { z } from "zod";
import { adminOrPermissionProcedure, protectedProcedure, router } from "../trpc";
import { TRPCError } from "@trpc/server";

const dashboardProcedure = adminOrPermissionProcedure("dashboard");

// Collaborator-level procedure: COLABORADOR or ADMIN
const colaboradorDashProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["ADMIN", "COLABORADOR"].includes(ctx.session.user.role as string)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Solo colaboradores" });
  }
  return next({ ctx });
});

// Client-level procedure: CLIENTE or ADMIN
const clientDashProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["ADMIN", "CLIENTE"].includes(ctx.session.user.role as string)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Solo clientes" });
  }
  return next({ ctx });
});

// Shared filter schema for date range + client
const filterSchema = z.object({
  dateFrom: z.string().optional(), // ISO date string
  dateTo: z.string().optional(),   // ISO date string
  clientId: z.string().optional(),
});

/** Build Prisma where clause from filters */
function buildWhere(input: z.infer<typeof filterSchema>) {
  const where: any = {};

  if (input.dateFrom || input.dateTo) {
    where.createdAt = {};
    if (input.dateFrom) where.createdAt.gte = new Date(input.dateFrom);
    if (input.dateTo) {
      const to = new Date(input.dateTo);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }

  if (input.clientId) {
    where.clientId = input.clientId;
  }

  return where;
}

export const metricsRouter = router({
  tasksByStatus: dashboardProcedure
    .input(filterSchema.optional().default({}))
    .query(async ({ ctx, input }) => {
      const where = buildWhere(input);
      const results = await ctx.db.task.groupBy({
        by: ["status"],
        where,
        _count: { id: true },
      });
      return results.map((r) => ({ status: r.status, count: r._count.id }));
    }),

  tasksByCategory: dashboardProcedure
    .input(filterSchema.optional().default({}))
    .query(async ({ ctx, input }) => {
      const where = buildWhere(input);
      const results = await ctx.db.task.groupBy({
        by: ["category"],
        where,
        _count: { id: true },
      });
      return results.map((r) => ({ category: r.category, count: r._count.id }));
    }),

  tasksByClient: dashboardProcedure
    .input(filterSchema.optional().default({}))
    .query(async ({ ctx, input }) => {
      const where = buildWhere(input);
      const results = await ctx.db.task.groupBy({
        by: ["clientId"],
        where,
        _count: { id: true },
      });

      const clients = await ctx.db.clientProfile.findMany({
        where: { id: { in: results.map((r) => r.clientId) } },
        select: { id: true, companyName: true, user: { select: { name: true } } },
      });

      const clientMap = new Map(clients.map((c) => [c.id, c]));

      return results.map((r) => {
        const client = clientMap.get(r.clientId);
        return {
          clientId: r.clientId,
          clientName: client?.companyName ?? client?.user.name ?? "Desconocido",
          count: r._count.id,
        };
      });
    }),

  tasksByMonth: dashboardProcedure
    .input(
      z.object({
        year: z.number().int().default(new Date().getFullYear()),
        clientId: z.string().optional(),
      }).optional().default({})
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        createdAt: {
          gte: new Date(input.year, 0, 1),
          lt: new Date(input.year + 1, 0, 1),
        },
      };
      if (input.clientId) where.clientId = input.clientId;

      const tasks = await ctx.db.task.findMany({
        where,
        select: { createdAt: true },
      });

      const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        count: 0,
      }));

      tasks.forEach((t) => {
        months[t.createdAt.getMonth()].count++;
      });

      return months;
    }),

  summary: dashboardProcedure
    .input(filterSchema.optional().default({}))
    .query(async ({ ctx, input }) => {
      const where = buildWhere(input);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Build completion and new-this-month filters
      const completedWhere: any = {
        ...where,
        status: "FINALIZADA",
        updatedAt: { gte: startOfMonth },
      };
      const newWhere: any = {
        ...where,
        createdAt: {
          ...(where.createdAt ?? {}),
          gte: where.createdAt?.gte
            ? new Date(Math.max(where.createdAt.gte.getTime(), startOfMonth.getTime()))
            : startOfMonth,
        },
      };
      const activeWhere: any = {
        ...where,
        status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA", "REVISION"] },
      };

      const [totalTasks, activeTasks, totalClients, totalColaboradores, completedThisMonth, newThisMonth] =
        await Promise.all([
          ctx.db.task.count({ where }),
          ctx.db.task.count({ where: activeWhere }),
          ctx.db.clientProfile.count(),
          ctx.db.colaboradorProfile.count(),
          ctx.db.task.count({ where: completedWhere }),
          ctx.db.task.count({ where: newWhere }),
        ]);

      return { totalTasks, activeTasks, totalClients, totalColaboradores, completedThisMonth, newThisMonth };
    }),

  recentActivity: dashboardProcedure
    .input(filterSchema.optional().default({}))
    .query(async ({ ctx, input }) => {
      const where = buildWhere(input);
      const recentTasks = await ctx.db.task.findMany({
        take: 8,
        where,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          taskNumber: true,
          status: true,
          category: true,
          updatedAt: true,
          service: { select: { name: true } },
          client: {
            select: {
              companyName: true,
              user: { select: { name: true } },
            },
          },
          colaborador: {
            select: {
              user: { select: { name: true } },
            },
          },
        },
      });

      return recentTasks;
    }),

  colaboradorWorkload: dashboardProcedure
    .input(filterSchema.optional().default({}))
    .query(async ({ ctx, input }) => {
      const clientFilter = input.clientId ? { clientId: input.clientId } : {};
      const colaboradores = await ctx.db.colaboradorProfile.findMany({
        include: {
          user: { select: { name: true } },
          _count: {
            select: {
              assignedTasks: {
                where: {
                  status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA"] },
                  ...clientFilter,
                },
              },
            },
          },
        },
      });

      return colaboradores.map((c) => ({
        id: c.id,
        name: c.user.name,
        activeTasks: c._count.assignedTasks,
      }));
    }),

  // ─── Collaborator-specific metrics ──────────────────
  myDashboard: colaboradorDashProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const colab = await ctx.db.colaboradorProfile.findUnique({ where: { userId } });
      if (!colab) return null;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [totalAssigned, active, inReview, completedThisMonth, completedTasks] = await Promise.all([
        ctx.db.task.count({ where: { colaboradorId: colab.id } }),
        ctx.db.task.count({
          where: { colaboradorId: colab.id, status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA"] } },
        }),
        ctx.db.task.count({
          where: { colaboradorId: colab.id, status: "REVISION" },
        }),
        ctx.db.task.count({
          where: {
            colaboradorId: colab.id,
            status: "FINALIZADA",
            completedAt: { gte: startOfMonth },
          },
        }),
        // For avg completion time calc
        ctx.db.task.findMany({
          where: {
            colaboradorId: colab.id,
            status: "FINALIZADA",
            startedAt: { not: null },
            completedAt: { not: null },
          },
          select: { startedAt: true, completedAt: true },
          take: 50,
          orderBy: { completedAt: "desc" },
        }),
      ]);

      // Average completion hours
      let avgCompletionHours = 0;
      if (completedTasks.length > 0) {
        const total = completedTasks.reduce((sum, t) => {
          const ms = t.completedAt!.getTime() - t.startedAt!.getTime();
          return sum + ms / (1000 * 60 * 60);
        }, 0);
        avgCompletionHours = Math.round((total / completedTasks.length) * 10) / 10;
      }

      return { totalAssigned, active, inReview, completedThisMonth, avgCompletionHours };
    }),

  myTasksByStatus: colaboradorDashProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const colab = await ctx.db.colaboradorProfile.findUnique({ where: { userId } });
      if (!colab) return [];

      const results = await ctx.db.task.groupBy({
        by: ["status"],
        where: { colaboradorId: colab.id },
        _count: { id: true },
      });
      return results.map((r) => ({ status: r.status, count: r._count.id }));
    }),

  myTasksByClient: colaboradorDashProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const colab = await ctx.db.colaboradorProfile.findUnique({ where: { userId } });
      if (!colab) return [];

      const results = await ctx.db.task.groupBy({
        by: ["clientId"],
        where: { colaboradorId: colab.id },
        _count: { id: true },
      });

      const clients = await ctx.db.clientProfile.findMany({
        where: { id: { in: results.map((r) => r.clientId) } },
        select: { id: true, companyName: true, user: { select: { name: true } } },
      });
      const clientMap = new Map(clients.map((c) => [c.id, c]));

      return results.map((r) => {
        const client = clientMap.get(r.clientId);
        return {
          clientId: r.clientId,
          clientName: client?.companyName ?? client?.user.name ?? "Desconocido",
          count: r._count.id,
        };
      });
    }),

  myRecentActivity: colaboradorDashProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const colab = await ctx.db.colaboradorProfile.findUnique({ where: { userId } });
      if (!colab) return [];

      return ctx.db.task.findMany({
        take: 10,
        where: { colaboradorId: colab.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          taskNumber: true,
          status: true,
          category: true,
          updatedAt: true,
          dueAt: true,
          service: { select: { name: true } },
          client: { select: { companyName: true, user: { select: { name: true } } } },
        },
      });
    }),

  myMonthlyTrend: colaboradorDashProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const colab = await ctx.db.colaboradorProfile.findUnique({ where: { userId } });
      if (!colab) return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, completed: 0 }));

      const year = new Date().getFullYear();
      const tasks = await ctx.db.task.findMany({
        where: {
          colaboradorId: colab.id,
          status: "FINALIZADA",
          completedAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
        },
        select: { completedAt: true },
      });

      const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, completed: 0 }));
      tasks.forEach((t) => {
        if (t.completedAt) months[t.completedAt.getMonth()].completed++;
      });
      return months;
    }),

  // ─── Profitability Report ──────────────────
  profitabilityByService: dashboardProcedure
    .input(filterSchema.optional().default({}))
    .query(async ({ ctx, input }) => {
      const where = { ...buildWhere(input), status: "FINALIZADA" as const, startedAt: { not: null }, completedAt: { not: null } };
      const tasks = await ctx.db.task.findMany({
        where,
        select: {
          estimatedHours: true,
          extraHours: true,
          startedAt: true,
          completedAt: true,
          serviceId: true,
        },
      });

      const byService = new Map<string, { estimated: number; actual: number; extra: number; count: number }>();
      tasks.forEach((t) => {
        const actualHrs = (t.completedAt!.getTime() - t.startedAt!.getTime()) / (1000 * 60 * 60);
        const entry = byService.get(t.serviceId) ?? { estimated: 0, actual: 0, extra: 0, count: 0 };
        entry.estimated += t.estimatedHours;
        entry.actual += actualHrs;
        entry.extra += t.extraHours;
        entry.count++;
        byService.set(t.serviceId, entry);
      });

      const services = await ctx.db.service.findMany({
        where: { id: { in: Array.from(byService.keys()) } },
        select: { id: true, name: true },
      });
      const svcMap = new Map(services.map((s) => [s.id, s.name]));

      return Array.from(byService.entries()).map(([serviceId, data]) => ({
        serviceId,
        serviceName: svcMap.get(serviceId) ?? "Desconocido",
        estimated: Math.round(data.estimated * 10) / 10,
        actual: Math.round(data.actual * 10) / 10,
        extra: data.extra,
        count: data.count,
        efficiency: data.estimated > 0 ? Math.round((data.estimated / data.actual) * 100) : 0,
      }));
    }),

  profitabilityByColaborador: dashboardProcedure
    .input(filterSchema.optional().default({}))
    .query(async ({ ctx, input }) => {
      const where: any = { ...buildWhere(input), status: "FINALIZADA", startedAt: { not: null }, completedAt: { not: null }, colaboradorId: { not: null } };
      const tasks = await ctx.db.task.findMany({
        where,
        select: {
          estimatedHours: true,
          extraHours: true,
          startedAt: true,
          completedAt: true,
          colaboradorId: true,
        },
      });

      const byColab = new Map<string, { estimated: number; actual: number; extra: number; count: number }>();
      tasks.forEach((t) => {
        if (!t.colaboradorId) return;
        const actualHrs = (t.completedAt!.getTime() - t.startedAt!.getTime()) / (1000 * 60 * 60);
        const entry = byColab.get(t.colaboradorId) ?? { estimated: 0, actual: 0, extra: 0, count: 0 };
        entry.estimated += t.estimatedHours;
        entry.actual += actualHrs;
        entry.extra += t.extraHours;
        entry.count++;
        byColab.set(t.colaboradorId, entry);
      });

      const colabs = await ctx.db.colaboradorProfile.findMany({
        where: { id: { in: Array.from(byColab.keys()) } },
        select: { id: true, user: { select: { name: true } } },
      });
      const colabMap = new Map(colabs.map((c) => [c.id, c.user.name]));

      return Array.from(byColab.entries()).map(([colabId, data]) => ({
        colaboradorId: colabId,
        colaboradorName: colabMap.get(colabId) ?? "Desconocido",
        estimated: Math.round(data.estimated * 10) / 10,
        actual: Math.round(data.actual * 10) / 10,
        extra: data.extra,
        count: data.count,
        efficiency: data.estimated > 0 ? Math.round((data.estimated / data.actual) * 100) : 0,
      }));
    }),

  profitabilityByClient: dashboardProcedure
    .input(filterSchema.optional().default({}))
    .query(async ({ ctx, input }) => {
      const where: any = { ...buildWhere(input), status: "FINALIZADA", startedAt: { not: null }, completedAt: { not: null } };
      const tasks = await ctx.db.task.findMany({
        where,
        select: {
          estimatedHours: true,
          extraHours: true,
          startedAt: true,
          completedAt: true,
          clientId: true,
        },
      });

      const byClient = new Map<string, { estimated: number; actual: number; extra: number; count: number }>();
      tasks.forEach((t) => {
        const actualHrs = (t.completedAt!.getTime() - t.startedAt!.getTime()) / (1000 * 60 * 60);
        const entry = byClient.get(t.clientId) ?? { estimated: 0, actual: 0, extra: 0, count: 0 };
        entry.estimated += t.estimatedHours;
        entry.actual += actualHrs;
        entry.extra += t.extraHours;
        entry.count++;
        byClient.set(t.clientId, entry);
      });

      const clients = await ctx.db.clientProfile.findMany({
        where: { id: { in: Array.from(byClient.keys()) } },
        select: { id: true, companyName: true, user: { select: { name: true } } },
      });
      const clientMap = new Map(clients.map((c) => [c.id, c]));

      return Array.from(byClient.entries()).map(([clientId, data]) => {
        const client = clientMap.get(clientId);
        return {
          clientId,
          clientName: client?.companyName ?? client?.user.name ?? "Desconocido",
          estimated: Math.round(data.estimated * 10) / 10,
          actual: Math.round(data.actual * 10) / 10,
          extra: data.extra,
          count: data.count,
          efficiency: data.estimated > 0 ? Math.round((data.estimated / data.actual) * 100) : 0,
        };
      });
    }),

  // ─── Client Dashboard ──────────────────
  clientDashboard: clientDashProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const client = await ctx.db.clientProfile.findUnique({
        where: { userId },
        include: {
          allowedServices: {
            include: { service: { select: { id: true, name: true } } },
          },
        },
      });
      if (!client) return null;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [total, active, completed, completedThisMonth, createdThisMonth, inReview] = await Promise.all([
        ctx.db.task.count({ where: { clientId: client.id } }),
        ctx.db.task.count({ where: { clientId: client.id, status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA"] } } }),
        ctx.db.task.count({ where: { clientId: client.id, status: "FINALIZADA" } }),
        ctx.db.task.count({ where: { clientId: client.id, status: "FINALIZADA", completedAt: { gte: startOfMonth } } }),
        ctx.db.task.count({ where: { clientId: client.id, createdAt: { gte: startOfMonth } } }),
        ctx.db.task.count({ where: { clientId: client.id, status: "REVISION" } }),
      ]);

      return {
        total, active, completed, completedThisMonth, createdThisMonth, inReview,
        monthlyLimit: client.monthlyTaskLimit,
        monthlyUsage: createdThisMonth,
        monthlyRemaining: Math.max(0, client.monthlyTaskLimit - createdThisMonth),
        planName: client.planName,
        planDescription: client.planDescription,
        revisionLimitPerTask: client.revisionLimitPerTask,
        allowedServices: client.allowedServices.map((a) => ({
          id: a.service.id,
          name: a.service.name,
        })),
      };
    }),

  clientTasksByStatus: clientDashProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const client = await ctx.db.clientProfile.findUnique({ where: { userId } });
      if (!client) return [];

      const results = await ctx.db.task.groupBy({
        by: ["status"],
        where: { clientId: client.id },
        _count: { id: true },
      });
      return results.map((r) => ({ status: r.status, count: r._count.id }));
    }),

  clientTasksByService: clientDashProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const client = await ctx.db.clientProfile.findUnique({ where: { userId } });
      if (!client) return [];

      const results = await ctx.db.task.groupBy({
        by: ["serviceId"],
        where: { clientId: client.id },
        _count: { id: true },
      });

      const services = await ctx.db.service.findMany({
        where: { id: { in: results.map((r) => r.serviceId) } },
        select: { id: true, name: true },
      });
      const svcMap = new Map(services.map((s) => [s.id, s.name]));

      return results.map((r) => ({
        serviceId: r.serviceId,
        serviceName: svcMap.get(r.serviceId) ?? "Desconocido",
        count: r._count.id,
      }));
    }),

  clientMonthlyTrend: clientDashProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const client = await ctx.db.clientProfile.findUnique({ where: { userId } });
      if (!client) return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, created: 0 }));

      const year = new Date().getFullYear();
      const tasks = await ctx.db.task.findMany({
        where: {
          clientId: client.id,
          createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
        },
        select: { createdAt: true },
      });

      const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, created: 0 }));
      tasks.forEach((t) => { months[t.createdAt.getMonth()].created++; });
      return months;
    }),

  clientRecentActivity: clientDashProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const client = await ctx.db.clientProfile.findUnique({ where: { userId } });
      if (!client) return [];

      return ctx.db.task.findMany({
        take: 8,
        where: { clientId: client.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          taskNumber: true,
          status: true,
          category: true,
          updatedAt: true,
          dueAt: true,
          service: { select: { name: true } },
        },
      });
    }),

  // Export data endpoint - returns raw task data for Excel generation
  exportData: dashboardProcedure
    .input(filterSchema.optional().default({}))
    .query(async ({ ctx, input }) => {
      const where = buildWhere(input);
      const tasks = await ctx.db.task.findMany({
        where,
        orderBy: { createdAt: "asc" },
        select: {
          taskNumber: true,
          title: true,
          status: true,
          category: true,
          estimatedHours: true,
          extraHours: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
          service: { select: { name: true } },
          client: {
            select: {
              companyName: true,
              user: { select: { name: true } },
            },
          },
          colaborador: {
            select: {
              user: { select: { name: true } },
            },
          },
        },
      });

      return tasks.map((t) => ({
        numero: t.taskNumber,
        titulo: t.title,
        estado: t.status,
        categoria: t.category,
        servicio: t.service.name,
        cliente: t.client.companyName ?? t.client.user.name,
        colaborador: t.colaborador?.user.name ?? "Sin asignar",
        horasEstimadas: t.estimatedHours,
        horasExtra: t.extraHours,
        fechaCreacion: t.createdAt.toISOString(),
        fechaInicio: t.startedAt?.toISOString() ?? "",
        fechaCompletado: t.completedAt?.toISOString() ?? "",
      }));
    }),
});
