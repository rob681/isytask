import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../trpc";
import { notifyTaskStatusChange } from "../lib/notifications";

function calculateNextRunAt(
  recurrenceType: "DAILY" | "WEEKLY" | "MONTHLY",
  recurrenceDay: number | null,
  recurrenceTime: string,
  fromDate?: Date
): Date {
  const [hours, minutes] = recurrenceTime.split(":").map(Number);
  const now = fromDate || new Date();
  const next = new Date(now);

  switch (recurrenceType) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY": {
      const targetDay = recurrenceDay ?? 1; // Default Monday
      const currentDay = next.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      next.setDate(next.getDate() + daysUntil);
      break;
    }
    case "MONTHLY": {
      const targetDate = recurrenceDay ?? 1;
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(targetDate, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      break;
    }
  }

  next.setHours(hours, minutes, 0, 0);
  return next;
}

const DAY_LABELS: Record<string, string> = {
  DAILY: "Diaria",
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
};

export const recurringRouter = router({
  // List all recurring tasks
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.recurringTask.findMany({
      include: {
        client: {
          include: { user: { select: { name: true } } },
        },
        service: { select: { name: true } },
        colaborador: {
          include: { user: { select: { name: true } } },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Create a recurring task
  create: adminProcedure
    .input(
      z.object({
        clientId: z.string(),
        serviceId: z.string(),
        colaboradorId: z.string().optional(),
        assignToUserId: z.string().optional(),
        title: z.string().min(1, "Título requerido"),
        description: z.string().optional(),
        category: z.enum(["URGENTE", "NORMAL", "LARGO_PLAZO"]).default("NORMAL"),
        formData: z.record(z.unknown()).optional(),
        recurrenceType: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
        recurrenceDay: z.number().int().min(0).max(31).optional().nullable(),
        recurrenceTime: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify client and service exist
      await ctx.db.clientProfile.findUniqueOrThrow({
        where: { id: input.clientId },
      });
      await ctx.db.service.findUniqueOrThrow({
        where: { id: input.serviceId },
      });

      // Resolve collaborator: explicit profile ID, self-assign by userId, or null
      let colaboradorId = input.colaboradorId ?? null;
      if (!colaboradorId && input.assignToUserId) {
        let profile = await ctx.db.colaboradorProfile.findUnique({
          where: { userId: input.assignToUserId },
        });
        if (!profile) {
          profile = await ctx.db.colaboradorProfile.create({
            data: { userId: input.assignToUserId },
          });
        }
        colaboradorId = profile.id;
      }

      const nextRunAt = calculateNextRunAt(
        input.recurrenceType,
        input.recurrenceDay ?? null,
        input.recurrenceTime
      );

      return ctx.db.recurringTask.create({
        data: {
          clientId: input.clientId,
          serviceId: input.serviceId,
          colaboradorId,
          title: input.title,
          description: input.description,
          category: input.category,
          formData: input.formData as any,
          recurrenceType: input.recurrenceType,
          recurrenceDay: input.recurrenceDay ?? null,
          recurrenceTime: input.recurrenceTime,
          nextRunAt,
          createdById: ctx.session.user.id,
        },
        include: {
          client: {
            include: { user: { select: { name: true } } },
          },
          service: { select: { name: true } },
        },
      });
    }),

  // Update a recurring task
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        category: z.enum(["URGENTE", "NORMAL", "LARGO_PLAZO"]).optional(),
        recurrenceType: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional(),
        recurrenceDay: z.number().int().min(0).max(31).optional().nullable(),
        recurrenceTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.db.recurringTask.findUniqueOrThrow({
        where: { id },
      });

      // Recalculate nextRunAt if recurrence settings changed
      let nextRunAt: Date | undefined;
      if (data.recurrenceType || data.recurrenceDay !== undefined || data.recurrenceTime) {
        nextRunAt = calculateNextRunAt(
          data.recurrenceType ?? existing.recurrenceType,
          data.recurrenceDay !== undefined ? data.recurrenceDay : existing.recurrenceDay,
          data.recurrenceTime ?? existing.recurrenceTime
        );
      }

      return ctx.db.recurringTask.update({
        where: { id },
        data: {
          ...data,
          ...(nextRunAt && { nextRunAt }),
        },
      });
    }),

  // Delete a recurring task
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.recurringTask.delete({
        where: { id: input.id },
      });
    }),

  // Execute due recurring tasks (called by cron/API route)
  executeDue: adminProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    const dueRecurring = await ctx.db.recurringTask.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      include: {
        client: {
          include: { user: { select: { id: true } } },
        },
        service: true,
      },
    });

    const results: Array<{ recurringTaskId: string; taskId: string; title: string }> = [];

    for (const rt of dueRecurring) {
      try {
        // Use pre-assigned collaborator, or auto-assign
        let autoColaboradorId: string | null = rt.colaboradorId;
        if (!autoColaboradorId) {
          const assignments = await ctx.db.colaboradorClientAssignment.findMany({
            where: { clientId: rt.clientId },
            select: { colaboradorId: true },
          });

          if (assignments.length === 1) {
            autoColaboradorId = assignments[0].colaboradorId;
          } else if (assignments.length > 1) {
            const colabIds = assignments.map((a) => a.colaboradorId);
            const taskCounts = await ctx.db.task.groupBy({
              by: ["colaboradorId"],
              where: {
                colaboradorId: { in: colabIds },
                status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA", "REVISION"] },
              },
              _count: true,
            });
            const countMap = new Map(taskCounts.map((tc) => [tc.colaboradorId, tc._count]));
            autoColaboradorId = colabIds.sort(
              (a, b) => (countMap.get(a) ?? 0) - (countMap.get(b) ?? 0)
            )[0];
          }
        }

        // Calculate dueAt from SLA
        let dueAt: Date | undefined;
        if (rt.service.slaHours) {
          dueAt = new Date();
          dueAt.setHours(dueAt.getHours() + rt.service.slaHours);
        }

        // Create the task
        const task = await ctx.db.task.create({
          data: {
            clientId: rt.clientId,
            serviceId: rt.serviceId,
            title: rt.title,
            description: rt.description,
            category: rt.category,
            estimatedHours: rt.service.estimatedHours,
            revisionsLimit: 3,
            formData: rt.formData as any,
            ...(dueAt && { dueAt }),
            ...(autoColaboradorId && { colaboradorId: autoColaboradorId }),
            statusLog: {
              create: {
                fromStatus: null,
                toStatus: "RECIBIDA",
                changedById: rt.createdById,
                note: "Tarea creada automáticamente (recurrente)",
              },
            },
          },
          include: {
            service: { select: { name: true } },
            client: { select: { userId: true } },
          },
        });

        // Update recurring task
        const nextRunAt = calculateNextRunAt(
          rt.recurrenceType,
          rt.recurrenceDay,
          rt.recurrenceTime,
          now
        );

        await ctx.db.recurringTask.update({
          where: { id: rt.id },
          data: {
            lastRunAt: now,
            nextRunAt,
          },
        });

        // Notify
        notifyTaskStatusChange({
          db: ctx.db,
          task: {
            id: task.id,
            taskNumber: task.taskNumber,
            clientId: task.clientId,
            colaboradorId: task.colaboradorId,
            client: { userId: task.client.userId },
            service: { name: task.service.name },
          },
          newStatus: "RECIBIDA",
        }).catch(() => {});

        results.push({
          recurringTaskId: rt.id,
          taskId: task.id,
          title: rt.title,
        });
      } catch (error) {
        console.error(`[Recurring] Failed to create task for ${rt.id}:`, error);
      }
    }

    return { executed: results.length, tasks: results };
  }),
});
