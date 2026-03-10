import { z } from "zod";
import { protectedProcedure, router, getAgencyId } from "../trpc";

export const searchRouter = router({
  global: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(20).default(8),
      })
    )
    .query(async ({ ctx, input }) => {
      const q = input.query.trim();
      if (!q) return { tasks: [], clients: [], colaboradores: [] };

      const role = ctx.session.user.role as string;
      const userId = ctx.session.user.id;
      const agencyId = getAgencyId(ctx);

      // Search tasks
      const taskWhere: any = {
        agencyId,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { taskNumber: isNaN(Number(q)) ? undefined : Number(q) },
        ].filter(Boolean),
      };

      // Scope for clients: only their tasks
      if (role === "CLIENTE") {
        const clientProfile = await ctx.db.clientProfile.findUnique({
          where: { userId },
        });
        if (clientProfile) {
          taskWhere.clientId = clientProfile.id;
        }
      }

      // Scope for colaboradores: only their assigned tasks
      if (role === "COLABORADOR") {
        const colabProfile = await ctx.db.colaboradorProfile.findUnique({
          where: { userId },
        });
        if (colabProfile) {
          taskWhere.colaboradorId = colabProfile.id;
        }
      }

      const tasks = await ctx.db.task.findMany({
        where: taskWhere,
        take: input.limit,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          taskNumber: true,
          title: true,
          status: true,
          category: true,
          client: {
            select: {
              companyName: true,
              user: { select: { name: true } },
            },
          },
          service: { select: { name: true } },
        },
      });

      // Search clients & colaboradores only for admin
      let clients: Array<{
        id: string;
        companyName: string | null;
        userName: string | null;
        email: string | null;
      }> = [];
      let colaboradores: Array<{
        id: string;
        userName: string | null;
        email: string | null;
      }> = [];

      if (role === "ADMIN") {
        const clientResults = await ctx.db.clientProfile.findMany({
          where: {
            user: { agencyId },
            OR: [
              { companyName: { contains: q, mode: "insensitive" } },
              { user: { name: { contains: q, mode: "insensitive" } } },
              { user: { email: { contains: q, mode: "insensitive" } } },
            ],
          },
          take: input.limit,
          select: {
            id: true,
            companyName: true,
            user: { select: { name: true, email: true } },
          },
        });

        clients = clientResults.map((c) => ({
          id: c.id,
          companyName: c.companyName,
          userName: c.user.name,
          email: c.user.email,
        }));

        const colabResults = await ctx.db.colaboradorProfile.findMany({
          where: {
            user: {
              agencyId,
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
          },
          take: input.limit,
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        });

        colaboradores = colabResults.map((c) => ({
          id: c.id,
          userName: c.user.name,
          email: c.user.email,
        }));
      }

      return { tasks, clients, colaboradores };
    }),
});
