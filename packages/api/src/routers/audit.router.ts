import { z } from "zod";
import { adminOrPermissionProcedure, router } from "../trpc";

const auditProcedure = adminOrPermissionProcedure("dashboard");

export const auditRouter = router({
  /**
   * Unified audit log view — aggregates:
   * - Task status changes (from TaskStatusLog)
   * - Task comments (from TaskComment)
   * - Task creations (from Task)
   * Returns a chronologically sorted list.
   */
  getLog: auditProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(30),
        entityType: z.enum(["ALL", "STATUS_CHANGE", "COMMENT", "TASK_CREATED"]).default("ALL"),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        userId: z.string().optional(),
        taskId: z.string().optional(),
      }).optional().default({})
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, entityType, dateFrom, dateTo, userId, taskId } = input;

      const dateWhere: any = {};
      if (dateFrom) dateWhere.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        dateWhere.lte = to;
      }
      const hasDateFilter = Object.keys(dateWhere).length > 0;

      type AuditEntry = {
        id: string;
        type: "STATUS_CHANGE" | "COMMENT" | "TASK_CREATED";
        taskId: string;
        taskNumber: number;
        taskTitle: string;
        userId: string;
        userName: string;
        detail: string;
        meta?: any;
        createdAt: Date;
      };

      const entries: AuditEntry[] = [];

      // 1. Status changes
      if (entityType === "ALL" || entityType === "STATUS_CHANGE") {
        const where: any = {};
        if (hasDateFilter) where.createdAt = dateWhere;
        if (userId) where.changedById = userId;
        if (taskId) where.taskId = taskId;

        const statusLogs = await ctx.db.taskStatusLog.findMany({
          where,
          include: {
            changedBy: { select: { id: true, name: true } },
            task: { select: { id: true, taskNumber: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        });

        statusLogs.forEach((log) => {
          entries.push({
            id: `sl_${log.id}`,
            type: "STATUS_CHANGE",
            taskId: log.task.id,
            taskNumber: log.task.taskNumber,
            taskTitle: log.task.title,
            userId: log.changedBy.id,
            userName: log.changedBy.name,
            detail: log.fromStatus
              ? `${log.fromStatus} → ${log.toStatus}`
              : `Creada como ${log.toStatus}`,
            meta: { fromStatus: log.fromStatus, toStatus: log.toStatus, note: log.note },
            createdAt: log.createdAt,
          });
        });
      }

      // 2. Comments
      if (entityType === "ALL" || entityType === "COMMENT") {
        const where: any = {};
        if (hasDateFilter) where.createdAt = dateWhere;
        if (userId) where.authorId = userId;
        if (taskId) where.taskId = taskId;

        const comments = await ctx.db.taskComment.findMany({
          where,
          include: {
            author: { select: { id: true, name: true } },
            task: { select: { id: true, taskNumber: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        });

        comments.forEach((c) => {
          entries.push({
            id: `cm_${c.id}`,
            type: "COMMENT",
            taskId: c.task.id,
            taskNumber: c.task.taskNumber,
            taskTitle: c.task.title,
            userId: c.author.id,
            userName: c.author.name,
            detail: c.content.length > 80 ? c.content.slice(0, 80) + "…" : c.content,
            meta: { isQuestion: c.isQuestion, isInternal: c.isInternal },
            createdAt: c.createdAt,
          });
        });
      }

      // 3. Task creations (first status log entry for each task = creation)
      if (entityType === "ALL" || entityType === "TASK_CREATED") {
        const taskWhere: any = {};
        if (hasDateFilter) taskWhere.createdAt = dateWhere;
        if (taskId) taskWhere.id = taskId;

        const tasks = await ctx.db.task.findMany({
          where: taskWhere,
          select: {
            id: true,
            taskNumber: true,
            title: true,
            createdAt: true,
            client: {
              select: {
                companyName: true,
                user: { select: { id: true, name: true } },
              },
            },
            service: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        });

        tasks.forEach((t) => {
          entries.push({
            id: `tc_${t.id}`,
            type: "TASK_CREATED",
            taskId: t.id,
            taskNumber: t.taskNumber,
            taskTitle: t.title,
            userId: t.client.user.id,
            userName: t.client.companyName ?? t.client.user.name,
            detail: `Creó tarea de ${t.service.name}`,
            createdAt: t.createdAt,
          });
        });
      }

      // Sort chronologically (newest first)
      entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Filter by userId if both status changes & comments are included
      const filtered = userId && entityType === "ALL"
        ? entries.filter((e) => e.userId === userId)
        : entries;

      // Paginate
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  // List of all users for filter dropdown
  getUsers: auditProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
  }),
});
