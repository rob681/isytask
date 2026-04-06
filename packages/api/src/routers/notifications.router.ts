import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

export const notificationsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const agencyId = ctx.session.user.agencyId;
      return ctx.db.notification.findMany({
        where: {
          userId: ctx.session.user.id,
          channel: "IN_APP",
          ...(agencyId ? { agencyId } : {}),
        },
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      });
    }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const agencyId = ctx.session.user.agencyId;
    return ctx.db.notification.count({
      where: {
        userId: ctx.session.user.id,
        channel: "IN_APP",
        isRead: false,
        ...(agencyId ? { agencyId } : {}),
      },
    });
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.notification.update({
        where: { id: input.id },
        data: { isRead: true },
      });
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const agencyId = ctx.session.user.agencyId;
    return ctx.db.notification.updateMany({
      where: {
        userId: ctx.session.user.id,
        isRead: false,
        ...(agencyId ? { agencyId } : {}),
      },
      data: { isRead: true },
    });
  }),
});
