import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  protectedProcedure,
  clienteProcedure,
  colaboradorProcedure,
  router,
} from "../trpc";
import {
  createTaskSchema,
  adminCreateTaskSchema,
  updateTaskStatusSchema,
  canTransition,
} from "@isytask/shared";
import { adminOrPermissionProcedure } from "../trpc";
import { notifyTaskStatusChange } from "../lib/notifications";
import { deleteFile as deleteStorageFile } from "../lib/supabase-storage";

function calculateElapsedHours(startedAt: Date | null): number {
  if (!startedAt) return 0;
  const ms = Date.now() - startedAt.getTime();
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
}

// Build a Zod schema dynamically from the service's form fields
function buildFormDataSchema(fields: Array<{
  fieldName: string;
  fieldType: string;
  isRequired: boolean;
  options: any;
  validation: any;
}>) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let fieldSchema: z.ZodTypeAny;
    const v = (field.validation as any) ?? {};

    switch (field.fieldType) {
      case "TEXT":
      case "TEXTAREA":
      case "URL": {
        let s = z.string();
        if (field.isRequired) s = s.min(1, "Este campo es requerido");
        if (v.minLength) s = s.min(v.minLength, `Mínimo ${v.minLength} caracteres`);
        if (v.maxLength) s = s.max(v.maxLength, `Máximo ${v.maxLength} caracteres`);
        if (field.fieldType === "URL") s = s.url("URL inválida");
        fieldSchema = s;
        break;
      }
      case "NUMBER": {
        let n = z.number();
        if (v.min !== undefined) n = n.min(v.min, `Mínimo ${v.min}`);
        if (v.max !== undefined) n = n.max(v.max, `Máximo ${v.max}`);
        fieldSchema = n;
        break;
      }
      case "SELECT": {
        const opts = (field.options as string[]) ?? [];
        if (opts.length > 0) {
          fieldSchema = z.enum(opts as [string, ...string[]]);
        } else {
          let s = z.string();
          if (field.isRequired) s = s.min(1, "Este campo es requerido");
          fieldSchema = s;
        }
        break;
      }
      case "MULTISELECT": {
        const opts = (field.options as string[]) ?? [];
        fieldSchema = z.array(z.string()).refine(
          (vals) => opts.length === 0 || vals.every((v) => opts.includes(v)),
          { message: "Opción inválida" }
        );
        break;
      }
      case "CHECKBOX":
        fieldSchema = z.boolean();
        break;
      case "COLOR_PICKER":
        fieldSchema = z.string();
        break;
      case "DATE":
        fieldSchema = z.string();
        break;
      case "FILE":
        fieldSchema = z.string();
        break;
      default:
        fieldSchema = z.unknown();
    }

    if (!field.isRequired) {
      fieldSchema = fieldSchema.optional().or(z.literal(""));
    }

    shape[field.fieldName] = fieldSchema;
  }

  return z.object(shape).passthrough();
}

export const tasksRouter = router({
  // Client: create a new task
  create: clienteProcedure
    .input(createTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const clientProfile = await ctx.db.clientProfile.findUnique({
        where: { userId: ctx.session.user.id },
      });
      if (!clientProfile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil de cliente no encontrado" });
      }

      // Check monthly task limit
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const tasksThisMonth = await ctx.db.task.count({
        where: {
          clientId: clientProfile.id,
          createdAt: { gte: startOfMonth },
        },
      });

      if (tasksThisMonth >= clientProfile.monthlyTaskLimit) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Has alcanzado el límite de ${clientProfile.monthlyTaskLimit} tareas mensuales`,
        });
      }

      // Check service access restriction
      const allowedServices = await ctx.db.clientServiceAccess.findMany({
        where: { clientId: clientProfile.id },
        select: { serviceId: true },
      });

      if (allowedServices.length > 0) {
        const allowedIds = allowedServices.map((s) => s.serviceId);
        if (!allowedIds.includes(input.serviceId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No tienes acceso a este servicio",
          });
        }
      }

      // Get service with form fields for validation
      const service = await ctx.db.service.findUniqueOrThrow({
        where: { id: input.serviceId },
        include: {
          formFields: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      // Validate formData against dynamic fields
      if (service.formFields.length > 0) {
        const formSchema = buildFormDataSchema(service.formFields);
        const result = formSchema.safeParse(input.formData ?? {});
        if (!result.success) {
          const firstError = result.error.errors[0];
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Campo "${firstError.path.join(".")}": ${firstError.message}`,
          });
        }
      }

      // Auto-assign collaborator based on client assignments
      let autoColaboradorId: string | null = null;
      const assignments = await ctx.db.colaboradorClientAssignment.findMany({
        where: { clientId: clientProfile.id },
        select: { colaboradorId: true },
      });

      if (assignments.length === 1) {
        autoColaboradorId = assignments[0].colaboradorId;
      } else if (assignments.length > 1) {
        // Pick the collaborator with fewest active tasks (load balancing)
        const colabIds = assignments.map((a) => a.colaboradorId);
        const taskCounts = await ctx.db.task.groupBy({
          by: ["colaboradorId"],
          where: {
            colaboradorId: { in: colabIds },
            status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA"] },
          },
          _count: true,
        });

        const countMap = new Map(
          taskCounts.map((tc) => [tc.colaboradorId, tc._count])
        );
        // Sort by task count ascending, pick the least busy one
        autoColaboradorId = colabIds.sort(
          (a, b) => (countMap.get(a) ?? 0) - (countMap.get(b) ?? 0)
        )[0];
      }

      // Calculate dueAt from SLA hours
      let dueAt: Date | undefined;
      if (service.slaHours) {
        dueAt = new Date();
        dueAt.setHours(dueAt.getHours() + service.slaHours);
      }

      const task = await ctx.db.task.create({
        data: {
          clientId: clientProfile.id,
          serviceId: input.serviceId,
          title: input.title,
          description: input.description,
          category: input.category,
          estimatedHours: service.estimatedHours,
          revisionsLimit: clientProfile.revisionLimitPerTask,
          formData: input.formData as any,
          ...(dueAt && { dueAt }),
          ...(autoColaboradorId && { colaboradorId: autoColaboradorId }),
          statusLog: {
            create: {
              fromStatus: null,
              toStatus: "RECIBIDA",
              changedById: ctx.session.user.id,
              note: "Tarea creada",
            },
          },
          // Dual-write: create TaskAssignment for primary collaborator
          ...(autoColaboradorId && {
            assignments: {
              create: { colaboradorId: autoColaboradorId, role: "PRIMARY" },
            },
          }),
        },
        include: {
          service: { select: { name: true } },
          client: { select: { userId: true } },
        },
      });

      // Notify: new task received (notify assigned collaborator if any)
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
      }).catch(() => {}); // fire and forget

      return task;
    }),

  // Admin/Colaborador: create task on behalf of a client
  createForClient: adminOrPermissionProcedure("manage_tasks")
    .input(adminCreateTaskSchema)
    .mutation(async ({ ctx, input }) => {
      // Get client profile
      const clientProfile = await ctx.db.clientProfile.findUniqueOrThrow({
        where: { id: input.clientId },
      });

      // Get service with form fields for validation
      const service = await ctx.db.service.findUniqueOrThrow({
        where: { id: input.serviceId },
        include: {
          formFields: { orderBy: { sortOrder: "asc" } },
        },
      });

      // Validate formData against dynamic fields
      if (service.formFields.length > 0) {
        const formSchema = buildFormDataSchema(service.formFields);
        const result = formSchema.safeParse(input.formData ?? {});
        if (!result.success) {
          const firstError = result.error.errors[0];
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Campo "${firstError.path.join(".")}": ${firstError.message}`,
          });
        }
      }

      // Determine collaborator: explicit, admin self-assign, or auto-assign
      let colaboradorId = input.colaboradorId ?? null;

      // Handle admin self-assign via userId
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

      if (!colaboradorId) {
        const assignments = await ctx.db.colaboradorClientAssignment.findMany({
          where: { clientId: clientProfile.id },
          select: { colaboradorId: true },
        });

        if (assignments.length === 1) {
          colaboradorId = assignments[0].colaboradorId;
        } else if (assignments.length > 1) {
          const colabIds = assignments.map((a) => a.colaboradorId);
          const taskCounts = await ctx.db.task.groupBy({
            by: ["colaboradorId"],
            where: {
              colaboradorId: { in: colabIds },
              status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA"] },
            },
            _count: true,
          });
          const countMap = new Map(
            taskCounts.map((tc) => [tc.colaboradorId, tc._count])
          );
          colaboradorId = colabIds.sort(
            (a, b) => (countMap.get(a) ?? 0) - (countMap.get(b) ?? 0)
          )[0];
        }
      }

      // Calculate dueAt from SLA hours
      let dueAtForClient: Date | undefined;
      if (service.slaHours) {
        dueAtForClient = new Date();
        dueAtForClient.setHours(dueAtForClient.getHours() + service.slaHours);
      }

      // Build assignment creates for dual-write
      const assignmentCreates: Array<{ colaboradorId: string; role: "PRIMARY" | "HELPER"; assignedById: string }> = [];
      if (colaboradorId) {
        assignmentCreates.push({ colaboradorId, role: "PRIMARY", assignedById: ctx.session.user.id });
      }
      // Additional helpers from input
      if (input.additionalAssignees?.length) {
        for (const helperColabId of input.additionalAssignees) {
          if (helperColabId !== colaboradorId) {
            assignmentCreates.push({ colaboradorId: helperColabId, role: "HELPER", assignedById: ctx.session.user.id });
          }
        }
      }

      const task = await ctx.db.task.create({
        data: {
          clientId: clientProfile.id,
          serviceId: input.serviceId,
          title: input.title,
          description: input.description,
          category: input.category,
          estimatedHours: service.estimatedHours,
          revisionsLimit: clientProfile.revisionLimitPerTask,
          formData: input.formData as any,
          ...(dueAtForClient && { dueAt: dueAtForClient }),
          ...(colaboradorId && { colaboradorId }),
          statusLog: {
            create: {
              fromStatus: null,
              toStatus: "RECIBIDA",
              changedById: ctx.session.user.id,
              note: "Tarea creada por administración",
            },
          },
          ...(assignmentCreates.length > 0 && {
            assignments: { create: assignmentCreates },
          }),
        },
        include: {
          service: { select: { name: true } },
          client: { select: { userId: true } },
        },
      });

      // Notify client
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

      return task;
    }),

  // Client: get my tasks
  getMyTasks: clienteProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        status: z
          .enum(["RECIBIDA", "EN_PROGRESO", "DUDA", "REVISION", "FINALIZADA", "CANCELADA"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const clientProfile = await ctx.db.clientProfile.findUnique({
        where: { userId: ctx.session.user.id },
      });
      if (!clientProfile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil no encontrado" });
      }

      const where = {
        clientId: clientProfile.id,
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
            _count: { select: { comments: true } },
          },
          orderBy: { createdAt: "asc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.task.count({ where }),
      ]);

      return { tasks, total, pages: Math.ceil(total / input.pageSize) };
    }),

  // Client: view task queue (with privacy model)
  getQueue: clienteProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const clientProfile = await ctx.db.clientProfile.findUnique({
        where: { userId: ctx.session.user.id },
      });
      if (!clientProfile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil no encontrado" });
      }

      const tasks = await ctx.db.task.findMany({
        where: {
          status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA", "REVISION"] },
        },
        include: {
          client: {
            include: { user: { select: { name: true, avatarUrl: true } } },
          },
          colaborador: {
            include: { user: { select: { name: true } } },
          },
          service: { select: { name: true, slaHours: true } },
          comments: {
            select: { id: true, isQuestion: true },
            where: { isQuestion: true },
          },
        },
        orderBy: { createdAt: "asc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      });

      return tasks.map((task, index) => {
        const isOwn = task.clientId === clientProfile.id;
        return {
          id: task.id,
          isOwn,
          queuePosition: (input.page - 1) * input.pageSize + index + 1,
          taskNumber: isOwn ? task.taskNumber : undefined,
          clientName: isOwn ? task.client.user.name : null,
          clientAvatar: isOwn ? task.client.user.avatarUrl : null,
          clientLogo: isOwn ? task.client.logoUrl : null,
          serviceType: isOwn ? task.service.name : null,
          title: isOwn ? task.title : null,
          category: task.category,
          status: task.status,
          estimatedHours: task.estimatedHours + task.extraHours,
          elapsedHours: calculateElapsedHours(task.startedAt),
          colaboradorName: isOwn ? task.colaborador?.user.name ?? null : null,
          hasUnreadComments: isOwn ? task.comments.length > 0 : false,
          commentCount: isOwn ? task.comments.length : 0,
          createdAt: isOwn ? task.createdAt : undefined,
          dueAt: isOwn ? task.dueAt : undefined,
        };
      });
    }),

  // Client: cancel task
  cancel: clienteProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const clientProfile = await ctx.db.clientProfile.findUnique({
        where: { userId: ctx.session.user.id },
      });
      const task = await ctx.db.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: { service: { select: { name: true } } },
      });

      if (task.clientId !== clientProfile?.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Esta tarea no te pertenece" });
      }

      if (!canTransition(task.status, "CANCELADA", "CLIENTE")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No se puede cancelar esta tarea en su estado actual",
        });
      }

      const result = await ctx.db.$transaction([
        ctx.db.task.update({
          where: { id: input.taskId },
          data: { status: "CANCELADA", completedAt: new Date() },
        }),
        ctx.db.taskStatusLog.create({
          data: {
            taskId: input.taskId,
            fromStatus: task.status,
            toStatus: "CANCELADA",
            changedById: ctx.session.user.id,
            note: "Cancelada por el cliente",
          },
        }),
      ]);

      // Notify about cancellation
      notifyTaskStatusChange({
        db: ctx.db,
        task: {
          id: task.id,
          taskNumber: task.taskNumber,
          clientId: task.clientId,
          colaboradorId: task.colaboradorId,
          client: { userId: clientProfile!.userId },
          service: { name: task.service.name },
        },
        newStatus: "CANCELADA",
      }).catch(() => {});

      return result;
    }),

  // Colaborador: get assigned tasks
  getAssigned: colaboradorProcedure
    .input(
      z.object({
        status: z
          .enum(["RECIBIDA", "EN_PROGRESO", "DUDA", "REVISION", "FINALIZADA", "CANCELADA"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.colaboradorProfile.findUnique({
        where: { userId: ctx.session.user.id },
      });
      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil no encontrado" });
      }

      return ctx.db.task.findMany({
        where: {
          OR: [
            { colaboradorId: profile.id },
            { assignments: { some: { colaboradorId: profile.id } } },
          ],
          ...(input.status && { status: input.status }),
        },
        include: {
          client: {
            include: { user: { select: { name: true } } },
          },
          service: { select: { name: true } },
          assignments: {
            include: { colaborador: { include: { user: { select: { name: true } } } } },
            orderBy: { role: "asc" },
          },
          _count: { select: { comments: true, attachments: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Colaborador/Admin: update task status
  updateStatus: protectedProcedure
    .input(updateTaskStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: {
          client: { include: { user: true } },
          service: { select: { name: true } },
        },
      });

      const userRole = ctx.session.user.role as "ADMIN" | "COLABORADOR" | "CLIENTE";

      if (!canTransition(task.status, input.newStatus, userRole)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No se puede cambiar de ${task.status} a ${input.newStatus}`,
        });
      }

      // Handle revision logic (from FINALIZADA or REVISION back to EN_PROGRESO)
      if ((task.status === "FINALIZADA" || task.status === "REVISION") && input.newStatus === "EN_PROGRESO") {
        if (task.revisionsUsed >= task.revisionsLimit) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Se alcanzó el límite de ${task.revisionsLimit} revisiones`,
          });
        }
      }

      const isRevisionReturn = (task.status === "FINALIZADA" || task.status === "REVISION") && input.newStatus === "EN_PROGRESO";

      const updated = await ctx.db.$transaction(async (tx) => {
        const updatedTask = await tx.task.update({
          where: { id: input.taskId },
          data: {
            status: input.newStatus,
            ...(input.newStatus === "EN_PROGRESO" &&
              !task.startedAt && { startedAt: new Date() }),
            ...(["FINALIZADA", "CANCELADA"].includes(input.newStatus) && {
              completedAt: new Date(),
            }),
            ...(isRevisionReturn && {
                revisionsUsed: { increment: 1 },
                completedAt: null,
                ...(input.extraHours && {
                  extraHours: { increment: input.extraHours },
                }),
              }),
          },
        });

        await tx.taskStatusLog.create({
          data: {
            taskId: input.taskId,
            fromStatus: task.status,
            toStatus: input.newStatus,
            changedById: ctx.session.user.id,
            note: input.note,
          },
        });

        return updatedTask;
      });

      // Notify about status change
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
        newStatus: input.newStatus,
      }).catch(() => {}); // fire and forget

      return updated;
    }),

  // Admin: assign task to colaborador or self
  assign: adminProcedure
    .input(
      z.object({
        taskId: z.string(),
        colaboradorId: z.string().optional(),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let colaboradorId = input.colaboradorId;

      // If userId provided (admin self-assign), find or create ColaboradorProfile
      if (input.userId && !colaboradorId) {
        let profile = await ctx.db.colaboradorProfile.findUnique({
          where: { userId: input.userId },
        });
        if (!profile) {
          profile = await ctx.db.colaboradorProfile.create({
            data: { userId: input.userId },
          });
        }
        colaboradorId = profile.id;
      }

      if (!colaboradorId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Se requiere un colaborador o usuario" });
      }

      // Update primary assignment + dual-write to TaskAssignment
      const task = await ctx.db.task.findUniqueOrThrow({ where: { id: input.taskId } });

      await ctx.db.$transaction(async (tx) => {
        // Set new primary on Task
        await tx.task.update({
          where: { id: input.taskId },
          data: { colaboradorId },
        });

        // Demote previous PRIMARY to HELPER (if different)
        if (task.colaboradorId && task.colaboradorId !== colaboradorId) {
          await tx.taskAssignment.updateMany({
            where: { taskId: input.taskId, colaboradorId: task.colaboradorId, role: "PRIMARY" },
            data: { role: "HELPER" },
          });
        }

        // Upsert new PRIMARY assignment
        await tx.taskAssignment.upsert({
          where: { taskId_colaboradorId: { taskId: input.taskId, colaboradorId } },
          create: { taskId: input.taskId, colaboradorId, role: "PRIMARY", assignedById: ctx.session.user.id },
          update: { role: "PRIMARY" },
        });
      });

      return ctx.db.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: {
          assignments: {
            include: { colaborador: { include: { user: { select: { name: true } } } } },
            orderBy: { role: "asc" },
          },
        },
      });
    }),

  // Admin: add a collaborator to a task
  addAssignee: adminProcedure
    .input(
      z.object({
        taskId: z.string(),
        colaboradorId: z.string().optional(),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let colaboradorId = input.colaboradorId;

      if (input.userId && !colaboradorId) {
        let profile = await ctx.db.colaboradorProfile.findUnique({
          where: { userId: input.userId },
        });
        if (!profile) {
          profile = await ctx.db.colaboradorProfile.create({
            data: { userId: input.userId },
          });
        }
        colaboradorId = profile.id;
      }

      if (!colaboradorId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Se requiere un colaborador" });
      }

      const task = await ctx.db.task.findUniqueOrThrow({ where: { id: input.taskId } });

      // Determine role: PRIMARY if task has no collaborator, HELPER otherwise
      const role = task.colaboradorId ? "HELPER" : "PRIMARY";

      await ctx.db.taskAssignment.upsert({
        where: { taskId_colaboradorId: { taskId: input.taskId, colaboradorId } },
        create: {
          taskId: input.taskId,
          colaboradorId,
          role: role as any,
          assignedById: ctx.session.user.id,
        },
        update: {}, // Already assigned, no-op
      });

      // If no primary set on task, set it
      if (!task.colaboradorId) {
        await ctx.db.task.update({
          where: { id: input.taskId },
          data: { colaboradorId },
        });
      }

      // Notify new assignee
      const taskFull = await ctx.db.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: {
          service: { select: { name: true } },
          client: { select: { userId: true } },
        },
      });
      const colab = await ctx.db.colaboradorProfile.findUnique({
        where: { id: colaboradorId },
        select: { userId: true },
      });
      if (colab) {
        const { sendNotification } = await import("../lib/notifications");
        sendNotification({
          db: ctx.db,
          userId: colab.userId,
          type: "TAREA_RECIBIDA",
          taskId: input.taskId,
          data: {
            taskNumber: String(taskFull.taskNumber),
            serviceType: taskFull.service.name,
          },
        }).catch(() => {});
      }

      return ctx.db.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: {
          assignments: {
            include: { colaborador: { include: { user: { select: { name: true } } } } },
            orderBy: { role: "asc" },
          },
        },
      });
    }),

  // Admin: remove a collaborator from a task
  removeAssignee: adminProcedure
    .input(
      z.object({
        taskId: z.string(),
        colaboradorId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.db.taskAssignment.findUnique({
        where: { taskId_colaboradorId: { taskId: input.taskId, colaboradorId: input.colaboradorId } },
      });

      if (!assignment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asignación no encontrada" });
      }

      await ctx.db.taskAssignment.delete({
        where: { id: assignment.id },
      });

      // If the removed was PRIMARY, promote next helper or clear
      if (assignment.role === "PRIMARY") {
        const nextHelper = await ctx.db.taskAssignment.findFirst({
          where: { taskId: input.taskId },
          orderBy: { assignedAt: "asc" },
        });

        if (nextHelper) {
          await ctx.db.$transaction([
            ctx.db.taskAssignment.update({
              where: { id: nextHelper.id },
              data: { role: "PRIMARY" },
            }),
            ctx.db.task.update({
              where: { id: input.taskId },
              data: { colaboradorId: nextHelper.colaboradorId },
            }),
          ]);
        } else {
          await ctx.db.task.update({
            where: { id: input.taskId },
            data: { colaboradorId: null },
          });
        }
      }

      return ctx.db.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: {
          assignments: {
            include: { colaborador: { include: { user: { select: { name: true } } } } },
            orderBy: { role: "asc" },
          },
        },
      });
    }),

  // Any authenticated: get task detail
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          client: {
            include: { user: { select: { name: true, avatarUrl: true } } },
          },
          colaborador: {
            include: { user: { select: { name: true } } },
          },
          service: {
            include: { formFields: { orderBy: { sortOrder: "asc" } } },
          },
          comments: {
            include: { author: { select: { name: true, role: true } } },
            orderBy: { createdAt: "asc" },
          },
          statusLog: {
            include: { changedBy: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
          attachments: { orderBy: { createdAt: "desc" } },
          assignments: {
            include: { colaborador: { include: { user: { select: { name: true } } } } },
            orderBy: { role: "asc" },
          },
        },
      });

      // Authorization check
      const role = ctx.session.user.role;
      if (role === "ADMIN") return task;

      if (role === "COLABORADOR") {
        const profile = await ctx.db.colaboradorProfile.findUnique({
          where: { userId: ctx.session.user.id },
        });
        // Allow access if primary assignee OR in assignments
        if (task.colaboradorId === profile?.id) return task;
        if (profile && task.assignments.some((a) => a.colaboradorId === profile.id)) return task;
      }

      if (role === "CLIENTE") {
        const profile = await ctx.db.clientProfile.findUnique({
          where: { userId: ctx.session.user.id },
        });
        if (task.clientId === profile?.id) return task;
      }

      throw new TRPCError({ code: "FORBIDDEN", message: "Sin acceso a esta tarea" });
    }),

  // Admin: list all tasks
  listAll: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        status: z
          .enum(["RECIBIDA", "EN_PROGRESO", "DUDA", "REVISION", "FINALIZADA", "CANCELADA"])
          .optional(),
        category: z.enum(["URGENTE", "NORMAL", "LARGO_PLAZO"]).optional(),
        clientId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        ...(input.status && { status: input.status }),
        ...(input.category && { category: input.category }),
        ...(input.clientId && { clientId: input.clientId }),
      };

      const [tasks, total] = await Promise.all([
        ctx.db.task.findMany({
          where,
          include: {
            client: {
              include: { user: { select: { name: true } } },
            },
            service: { select: { name: true } },
            colaborador: {
              include: { user: { select: { name: true } } },
            },
            assignments: {
              include: { colaborador: { include: { user: { select: { name: true } } } } },
              orderBy: { role: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.task.count({ where }),
      ]);

      return { tasks, total, pages: Math.ceil(total / input.pageSize) };
    }),

  // Kanban view: get tasks for board (admin or colaborador)
  listForKanban: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        category: z.enum(["URGENTE", "NORMAL", "LARGO_PLAZO"]).optional(),
      }).optional().default({})
    )
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role as string;
      const where: any = {};

      if (input.category) where.category = input.category;
      if (input.clientId) where.clientId = input.clientId;

      // Colaborador: only assigned tasks (primary or helper)
      if (role === "COLABORADOR") {
        const profile = await ctx.db.colaboradorProfile.findUnique({
          where: { userId: ctx.session.user.id },
        });
        if (!profile) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Perfil no encontrado" });
        }
        where.OR = [
          { colaboradorId: profile.id },
          { assignments: { some: { colaboradorId: profile.id } } },
        ];
      } else if (role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const tasks = await ctx.db.task.findMany({
        where,
        include: {
          client: {
            include: { user: { select: { name: true } } },
          },
          service: { select: { name: true } },
          colaborador: {
            include: { user: { select: { name: true } } },
          },
          assignments: {
            include: { colaborador: { include: { user: { select: { name: true } } } } },
            orderBy: { role: "asc" },
          },
          _count: { select: { comments: true, attachments: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 200,
      });

      return tasks;
    }),

  // Quick status update for Kanban drag & drop
  updateStatusQuick: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        newStatus: z.enum(["RECIBIDA", "EN_PROGRESO", "DUDA", "REVISION", "FINALIZADA", "CANCELADA"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: {
          client: { include: { user: true } },
          service: { select: { name: true } },
        },
      });

      const userRole = ctx.session.user.role as "ADMIN" | "COLABORADOR" | "CLIENTE";

      if (!canTransition(task.status, input.newStatus, userRole)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No se puede cambiar de ${task.status} a ${input.newStatus}`,
        });
      }

      const updated = await ctx.db.$transaction(async (tx) => {
        const updatedTask = await tx.task.update({
          where: { id: input.taskId },
          data: {
            status: input.newStatus,
            ...(input.newStatus === "EN_PROGRESO" &&
              !task.startedAt && { startedAt: new Date() }),
            ...(["FINALIZADA", "CANCELADA"].includes(input.newStatus) && {
              completedAt: new Date(),
            }),
          },
        });

        await tx.taskStatusLog.create({
          data: {
            taskId: input.taskId,
            fromStatus: task.status,
            toStatus: input.newStatus,
            changedById: ctx.session.user.id,
            note: "Cambio de estado desde tablero Kanban",
          },
        });

        return updatedTask;
      });

      // Notify about status change
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
        newStatus: input.newStatus,
      }).catch(() => {});

      return updated;
    }),

  // Add attachment to task
  addAttachment: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
        url: z.string(),
        storagePath: z.string(),
        isDeliverable: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify task exists and user has access
      const task = await ctx.db.task.findUniqueOrThrow({
        where: { id: input.taskId },
      });

      const role = ctx.session.user.role;
      if (role === "CLIENTE") {
        const clientProfile = await ctx.db.clientProfile.findUnique({
          where: { userId: ctx.session.user.id },
        });
        if (!clientProfile || task.clientId !== clientProfile.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }

      return ctx.db.taskAttachment.create({
        data: {
          taskId: input.taskId,
          fileName: input.fileName,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          storagePath: input.storagePath,
          fileUrl: input.url,
          uploadedById: ctx.session.user.id,
          isDeliverable: input.isDeliverable,
        },
      });
    }),

  // Delete attachment
  deleteAttachment: protectedProcedure
    .input(z.object({ attachmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await ctx.db.taskAttachment.findUniqueOrThrow({
        where: { id: input.attachmentId },
      });

      // Only the uploader or admin can delete
      if (
        attachment.uploadedById !== ctx.session.user.id &&
        ctx.session.user.role !== "ADMIN"
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Delete from Supabase Storage (fire-and-forget)
      deleteStorageFile(attachment.storagePath).catch((err) => {
        console.error("[Storage] Failed to delete file:", err);
      });

      return ctx.db.taskAttachment.delete({
        where: { id: input.attachmentId },
      });
    }),
});
