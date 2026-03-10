import { z } from "zod";
import { adminOrPermissionProcedure, router, getAgencyId } from "../trpc";

const clientsProcedure = adminOrPermissionProcedure("manage_clients");

export const clientsRouter = router({
  list: clientsProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const agencyId = getAgencyId(ctx);
      const where = {
        user: {
          agencyId,
          role: "CLIENTE" as const,
          ...(input.search && {
            OR: [
              { name: { contains: input.search, mode: "insensitive" as const } },
              { email: { contains: input.search, mode: "insensitive" as const } },
            ],
          }),
        },
      };

      const [clients, total] = await Promise.all([
        ctx.db.clientProfile.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                isActive: true,
                avatarUrl: true,
                passwordHash: true,
              },
            },
            assignedColaboradors: {
              include: {
                colaborador: {
                  include: {
                    user: { select: { name: true } },
                  },
                },
              },
            },
            allowedServices: {
              select: { serviceId: true },
            },
            _count: { select: { tasks: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.clientProfile.count({ where }),
      ]);

      // Map passwordHash to hasPassword boolean (never send hash to frontend)
      const mappedClients = clients.map((client) => ({
        ...client,
        user: {
          ...client.user,
          hasPassword: !!client.user.passwordHash,
          passwordHash: undefined,
        },
      }));

      return { clients: mappedClients, total, pages: Math.ceil(total / input.pageSize) };
    }),

  getById: clientsProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.clientProfile.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              isActive: true,
              avatarUrl: true,
            },
          },
          assignedColaboradors: {
            include: {
              colaborador: {
                include: { user: { select: { name: true, email: true } } },
              },
            },
          },
          _count: { select: { tasks: true } },
        },
      });
    }),

  assignColaborador: clientsProcedure
    .input(
      z.object({
        clientId: z.string(),
        colaboradorId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.colaboradorClientAssignment.create({
        data: {
          clientId: input.clientId,
          colaboradorId: input.colaboradorId,
        },
      });
    }),

  removeColaborador: clientsProcedure
    .input(
      z.object({
        clientId: z.string(),
        colaboradorId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.colaboradorClientAssignment.delete({
        where: {
          colaboradorId_clientId: {
            colaboradorId: input.colaboradorId,
            clientId: input.clientId,
          },
        },
      });
    }),

  updateLimits: clientsProcedure
    .input(
      z.object({
        id: z.string(),
        monthlyTaskLimit: z.number().int().min(1).optional(),
        revisionLimitPerTask: z.number().int().min(0).optional(),
        companyName: z.string().optional(),
        planName: z.string().min(1).optional(),
        planDescription: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.clientProfile.update({
        where: { id },
        data,
      });
    }),

  addServiceAccess: clientsProcedure
    .input(
      z.object({
        clientId: z.string(),
        serviceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.clientServiceAccess.create({
        data: {
          clientId: input.clientId,
          serviceId: input.serviceId,
        },
      });
    }),

  removeServiceAccess: clientsProcedure
    .input(
      z.object({
        clientId: z.string(),
        serviceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.clientServiceAccess.delete({
        where: {
          clientId_serviceId: {
            clientId: input.clientId,
            serviceId: input.serviceId,
          },
        },
      });
    }),

  getTaskHistory: clientsProcedure
    .input(
      z.object({
        clientId: z.string(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        status: z
          .enum(["RECIBIDA", "EN_PROGRESO", "DUDA", "FINALIZADA", "CANCELADA"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        clientId: input.clientId,
        ...(input.status && { status: input.status }),
      };

      const [tasks, total] = await Promise.all([
        ctx.db.task.findMany({
          where,
          include: {
            service: { select: { name: true } },
            colaborador: {
              include: { user: { select: { name: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.task.count({ where }),
      ]);

      return { tasks, total, pages: Math.ceil(total / input.pageSize) };
    }),
});
