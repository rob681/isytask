import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../trpc";
import { createServiceSchema, updateServiceSchema, updateServiceSchemaFull, formFieldConfigSchema } from "@isytask/shared";

export const servicesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role;
    let whereIds: string[] | undefined;

    // If user is CLIENTE, check if they have service access restrictions
    if (role === "CLIENTE") {
      const clientProfile = await ctx.db.clientProfile.findUnique({
        where: { userId: ctx.session.user.id },
        include: { allowedServices: { select: { serviceId: true } } },
      });

      if (clientProfile && clientProfile.allowedServices.length > 0) {
        whereIds = clientProfile.allowedServices.map((s) => s.serviceId);
      }
    }

    return ctx.db.service.findMany({
      where: {
        isActive: true,
        ...(whereIds && { id: { in: whereIds } }),
      },
      include: {
        _count: { select: { formFields: true, tasks: true } },
      },
      orderBy: { name: "asc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.service.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          formFields: { orderBy: { sortOrder: "asc" } },
          _count: { select: { tasks: true } },
        },
      });
    }),

  create: adminProcedure
    .input(createServiceSchema.extend({
      slaHours: z.number().int().min(1).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.service.create({ data: input });
    }),

  update: adminProcedure
    .input(updateServiceSchemaFull)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.service.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.service.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  // Form field management
  getFormFields: protectedProcedure
    .input(z.object({ serviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.serviceFormField.findMany({
        where: { serviceId: input.serviceId },
        orderBy: { sortOrder: "asc" },
      });
    }),

  addFormField: adminProcedure
    .input(formFieldConfigSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.serviceFormField.create({ data: input });
    }),

  updateFormField: adminProcedure
    .input(
      z.object({
        id: z.string(),
        label: z.string().optional(),
        fieldType: z
          .enum([
            "TEXT", "TEXTAREA", "NUMBER", "SELECT", "MULTISELECT",
            "CHECKBOX", "COLOR_PICKER", "FILE", "DATE", "URL",
          ])
          .optional(),
        placeholder: z.string().optional(),
        isRequired: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
        options: z.array(z.string()).optional(),
        validation: z
          .object({
            min: z.number().optional(),
            max: z.number().optional(),
            minLength: z.number().optional(),
            maxLength: z.number().optional(),
            pattern: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.serviceFormField.update({ where: { id }, data });
    }),

  removeFormField: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.serviceFormField.delete({ where: { id: input.id } });
    }),

  reorderFields: adminProcedure
    .input(
      z.object({
        fields: z.array(
          z.object({ id: z.string(), sortOrder: z.number().int().min(0) })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(
        input.fields.map((f) =>
          ctx.db.serviceFormField.update({
            where: { id: f.id },
            data: { sortOrder: f.sortOrder },
          })
        )
      );
    }),

  // Get AI agent config for a service (used by client task creation page)
  getAgentConfig: protectedProcedure
    .input(z.object({ serviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = await ctx.db.service.findUnique({
        where: { id: input.serviceId },
        select: { agentEnabled: true, agentModel: true, name: true },
      });
      return {
        agentEnabled: service?.agentEnabled ?? false,
        agentModel: service?.agentModel ?? null,
        serviceName: service?.name ?? "",
      };
    }),
});
