/**
 * Cross-App Router: Isytask ↔ Isysocial integration endpoints
 *
 * Provides:
 * - Link/unlink task ↔ post
 * - Get linked post info
 * - Receive events from Isysocial
 * - Query integration status
 */

import { z } from "zod";
import { router, adminProcedure, protectedProcedure, getAgencyId } from "../trpc";
import {
  hasIntegrationActive,
  emitCrossAppEvent,
  getLinkedPostInfo,
} from "../lib/cross-app-sync";

export const crossAppRouter = router({
  /** Check if cross-app integration is active for this agency */
  isActive: protectedProcedure.query(async ({ ctx }) => {
    const agencyId = getAgencyId(ctx);
    const active = await hasIntegrationActive(ctx.db, agencyId);
    return { active };
  }),

  /** Get info about a linked Isysocial post for a task */
  getLinkedPost: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUnique({
        where: { id: input.taskId },
        select: { isysocialPostId: true, isysocialPostType: true },
      });

      if (!task?.isysocialPostId) {
        return { linked: false as const };
      }

      const postInfo = await getLinkedPostInfo(ctx.db, task.isysocialPostId);
      if (!postInfo) {
        return { linked: false as const };
      }

      return {
        linked: true as const,
        post: {
          ...postInfo,
          localPostType: task.isysocialPostType,
        },
      };
    }),

  /** Link a task to an Isysocial post (admin only) */
  linkPost: adminProcedure
    .input(
      z.object({
        taskId: z.string(),
        isysocialPostId: z.string(),
        isysocialPostType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const agencyId = getAgencyId(ctx);

      // Verify post exists in Isysocial
      const postInfo = await getLinkedPostInfo(ctx.db, input.isysocialPostId);
      if (!postInfo) {
        throw new Error("Post no encontrado en Isysocial");
      }

      // Update both sides
      await ctx.db.task.update({
        where: { id: input.taskId },
        data: {
          isysocialPostId: input.isysocialPostId,
          isysocialPostType: input.isysocialPostType ?? postInfo.postType,
        },
      });

      // Update isysocial post with isytaskTaskId
      const isysocialAgencyResult = await ctx.db.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT iso.id FROM isysocial.iso_agencies iso
         JOIN public.agencies pub ON pub.name = iso.name
         WHERE pub.id = $1 LIMIT 1`,
        agencyId
      );

      if (isysocialAgencyResult.length) {
        await ctx.db.$executeRawUnsafe(
          `UPDATE isysocial.iso_posts
           SET "isytaskTaskId" = $1, "updatedAt" = NOW()
           WHERE id = $2 AND "agencyId" = $3`,
          input.taskId,
          input.isysocialPostId,
          isysocialAgencyResult[0].id
        );
      }

      return { success: true };
    }),

  /** Unlink a task from an Isysocial post */
  unlinkPost: adminProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const agencyId = getAgencyId(ctx);
      const task = await ctx.db.task.findUnique({
        where: { id: input.taskId },
        select: { isysocialPostId: true },
      });

      if (task?.isysocialPostId) {
        // Clear isytaskTaskId in Isysocial
        const isysocialAgencyResult = await ctx.db.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT iso.id FROM isysocial.iso_agencies iso
           JOIN public.agencies pub ON pub.name = iso.name
           WHERE pub.id = $1 LIMIT 1`,
          agencyId
        );

        if (isysocialAgencyResult.length) {
          await ctx.db.$executeRawUnsafe(
            `UPDATE isysocial.iso_posts
             SET "isytaskTaskId" = NULL, "updatedAt" = NOW()
             WHERE id = $1 AND "agencyId" = $2`,
            task.isysocialPostId,
            isysocialAgencyResult[0].id
          );
        }
      }

      await ctx.db.task.update({
        where: { id: input.taskId },
        data: { isysocialPostId: null, isysocialPostType: null },
      });

      return { success: true };
    }),

  /** List available Isysocial posts for linking (not yet linked) */
  availablePosts: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const agencyId = getAgencyId(ctx);

      const isysocialAgencyResult = await ctx.db.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT iso.id FROM isysocial.iso_agencies iso
         JOIN public.agencies pub ON pub.name = iso.name
         WHERE pub.id = $1 LIMIT 1`,
        agencyId
      );

      if (!isysocialAgencyResult.length) return [];

      const isoAgencyId = isysocialAgencyResult[0].id;
      const searchFilter = input.search
        ? `AND (p.title ILIKE '%' || $3 || '%' OR p.copy ILIKE '%' || $3 || '%')`
        : "";

      const params: unknown[] = [isoAgencyId, input.limit];
      if (input.search) params.push(input.search);

      const posts = await ctx.db.$queryRawUnsafe<
        Array<{
          id: string;
          title: string | null;
          status: string;
          network: string;
          postType: string;
          clientName: string | null;
          createdAt: Date;
        }>
      >(
        `SELECT p.id, p.title, p.status, p.network, p."postType",
                cp."companyName" as "clientName", p."createdAt"
         FROM isysocial.iso_posts p
         LEFT JOIN isysocial.iso_client_profiles cp ON p."clientId" = cp.id
         WHERE p."agencyId" = $1
           AND p."isytaskTaskId" IS NULL
           AND p.status NOT IN ('PUBLISHED', 'CANCELLED')
           ${searchFilter}
         ORDER BY p."createdAt" DESC
         LIMIT $2`,
        ...params
      );

      return posts;
    }),

  /** Get cross-app event history for a task */
  eventHistory: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.crossAppEvent.findMany({
        where: { taskId: input.taskId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    }),
});
