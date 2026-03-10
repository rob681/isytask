import { z } from "zod";
import { adminProcedure, protectedProcedure, router, getAgencyId } from "../trpc";

export const templatesRouter = router({
  /** List templates – admin sees all, clients see only for their allowed services */
  list: protectedProcedure
    .input(
      z.object({
        serviceId: z.string().optional(),
        activeOnly: z.boolean().optional().default(true),
      }).optional().default({})
    )
    .query(async ({ ctx, input }) => {
      const agencyId = getAgencyId(ctx);
      const where: any = { agencyId };

      if (input.activeOnly) where.isActive = true;
      if (input.serviceId) where.serviceId = input.serviceId;

      // If client, filter to allowed services
      if (ctx.session.user.role === "CLIENTE") {
        const clientProfile = await ctx.db.clientProfile.findUnique({
          where: { userId: ctx.session.user.id },
          include: { allowedServices: { select: { serviceId: true } } },
        });
        if (clientProfile && clientProfile.allowedServices.length > 0) {
          const allowedIds = clientProfile.allowedServices.map((s) => s.serviceId);
          where.serviceId = input.serviceId
            ? (allowedIds.includes(input.serviceId) ? input.serviceId : "__none__")
            : { in: allowedIds };
        }
      }

      return ctx.db.taskTemplate.findMany({
        where,
        include: {
          service: { select: { id: true, name: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    }),

  /** Get single template by ID */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.taskTemplate.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          service: {
            select: { id: true, name: true, estimatedHours: true },
          },
        },
      });
    }),

  /** Create template (admin only) */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        description: z.string().optional(),
        serviceId: z.string(),
        category: z.enum(["URGENTE", "NORMAL", "LARGO_PLAZO"]).default("NORMAL"),
        formData: z.record(z.any()).optional(),
        sortOrder: z.number().int().min(0).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const agencyId = getAgencyId(ctx);
      return ctx.db.taskTemplate.create({ data: { ...input, agencyId } });
    }),

  /** Update template (admin only) */
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(120).optional(),
        description: z.string().optional().nullable(),
        serviceId: z.string().optional(),
        category: z.enum(["URGENTE", "NORMAL", "LARGO_PLAZO"]).optional(),
        formData: z.record(z.any()).optional().nullable(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, serviceId, ...rest } = input;
      const data: any = { ...rest };
      if (serviceId) {
        data.service = { connect: { id: serviceId } };
      }
      return ctx.db.taskTemplate.update({ where: { id }, data });
    }),

  /** Delete template (soft – set isActive false) */
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.taskTemplate.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),
});
