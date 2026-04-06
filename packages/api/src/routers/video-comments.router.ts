import { router, protectedProcedure } from "../trpc";
import { z } from "zod";
import {
  createVideoCommentSchema,
  updateVideoCommentSchema,
  deleteVideoCommentSchema,
} from "@isytask/shared";

export const videoCommentsRouter = router({
  // ─── Create video comment with timecode ────────────────────────────────
  create: protectedProcedure
    .input(createVideoCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.videoComment.create({
        data: {
          mediaType: input.mediaType,
          mediaId: input.mediaId,
          authorId: ctx.session.user.id,
          content: input.content,
          timecodeSeconds: input.timecodeSeconds,
          isInternal: input.isInternal,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      return comment;
    }),

  // ─── List comments for a video (sorted by timecode) ────────────────────
  listByMedia: protectedProcedure
    .input(
      z.object({
        mediaType: z.enum(["POST_MEDIA", "TASK_FILE"]),
        mediaId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const comments = await ctx.db.videoComment.findMany({
        where: {
          mediaType: input.mediaType,
          mediaId: input.mediaId,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: [{ timecodeSeconds: "asc" }, { createdAt: "asc" }],
      });

      return comments;
    }),

  // ─── Get timeline timestamps (for marker rendering) ────────────────────
  getTimestamps: protectedProcedure
    .input(
      z.object({
        mediaType: z.enum(["POST_MEDIA", "TASK_FILE"]),
        mediaId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const comments = await ctx.db.videoComment.findMany({
        where: {
          mediaType: input.mediaType,
          mediaId: input.mediaId,
          timecodeSeconds: {
            not: null,
          },
        },
        select: {
          timecodeSeconds: true,
        },
        orderBy: { timecodeSeconds: "asc" },
      });

      // Return only unique timestamps
      const timestamps = Array.from(
        new Map(
          comments.map((c) => [
            c.timecodeSeconds!.toString(),
            c.timecodeSeconds!,
          ])
        ).values()
      );

      return timestamps;
    }),

  // ─── Update comment (resolve, edit content) ────────────────────────────
  update: protectedProcedure
    .input(updateVideoCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.videoComment.update({
        where: { id: input.commentId },
        data: {
          ...(input.content && { content: input.content }),
          ...(input.isResolved !== undefined && {
            isResolved: input.isResolved,
          }),
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      return comment;
    }),

  // ─── Delete comment ────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(deleteVideoCommentSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.videoComment.delete({
        where: { id: input.commentId },
      });

      return { success: true };
    }),
});
