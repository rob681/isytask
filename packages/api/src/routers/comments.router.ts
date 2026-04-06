import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { createCommentSchema } from "@isytask/shared";
import { notifyNewComment } from "../lib/notifications";

export const commentsRouter = router({
  list: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.taskComment.findMany({
        where: {
          taskId: input.taskId,
          ...(ctx.session.user.role !== "ADMIN" && { isInternal: false }),
        },
        include: {
          author: { select: { name: true, role: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  create: protectedProcedure
    .input(createCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.taskComment.create({
        data: {
          taskId: input.taskId,
          authorId: ctx.session.user.id,
          content: input.content,
          isQuestion:
            input.isQuestion && ctx.session.user.role === "COLABORADOR",
        },
        include: {
          author: { select: { name: true, role: true } },
        },
      });

      // Fetch task info for notification
      const task = await ctx.db.task.findUnique({
        where: { id: input.taskId },
        include: {
          client: { select: { userId: true } },
          service: { select: { name: true } },
        },
      });

      if (task) {
        notifyNewComment({
          db: ctx.db,
          task: {
            id: task.id,
            taskNumber: task.taskNumber,
            agencyId: task.agencyId,
            clientId: task.clientId,
            colaboradorId: task.colaboradorId,
            client: { userId: task.client.userId },
            service: { name: task.service.name },
          },
          commentAuthorId: ctx.session.user.id,
        }).catch(() => {});
      }

      return comment;
    }),
});
