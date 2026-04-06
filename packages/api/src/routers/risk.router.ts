import { z } from "zod";
import { router, adminProcedure, getAgencyId } from "../trpc";
import { analyzeAgencyRisks } from "../lib/risk-engine";

export const riskRouter = router({
  // ─── Dashboard overview: risk summary + at-risk tasks ───
  overview: adminProcedure.query(async ({ ctx }) => {
    const agencyId = getAgencyId(ctx);

    const [assessments, totalActiveTasks] = await Promise.all([
      ctx.db.riskAssessment.findMany({
        where: { agencyId },
        include: {
          task: {
            select: {
              id: true,
              taskNumber: true,
              title: true,
              status: true,
              category: true,
              dueAt: true,
              client: {
                select: {
                  companyName: true,
                  user: { select: { name: true } },
                },
              },
              service: { select: { name: true } },
              colaborador: {
                select: { user: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { riskScore: "desc" },
      }),
      ctx.db.task.count({
        where: {
          agencyId,
          status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA", "REVISION"] },
        },
      }),
    ]);

    const red = assessments.filter((a) => a.riskLevel === "RED");
    const yellow = assessments.filter((a) => a.riskLevel === "YELLOW");
    const green = assessments.filter((a) => a.riskLevel === "GREEN");

    // Health score: 100 = all green, 0 = all red
    const healthScore =
      assessments.length > 0
        ? Math.round(
            ((green.length * 100 + yellow.length * 50) /
              (assessments.length * 100)) *
              100
          )
        : 100;

    return {
      healthScore,
      totalActiveTasks,
      totalAssessed: assessments.length,
      counts: {
        red: red.length,
        yellow: yellow.length,
        green: green.length,
      },
      redTasks: red.slice(0, 10),
      yellowTasks: yellow.slice(0, 10),
      lastAnalyzedAt: assessments[0]?.analyzedAt ?? null,
    };
  }),

  // ─── Risk detail for a single task ───
  taskRisk: adminProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.riskAssessment.findUnique({
        where: { taskId: input.taskId },
      });
    }),

  // ─── Manually trigger risk analysis ───
  analyze: adminProcedure.mutation(async ({ ctx }) => {
    const agencyId = getAgencyId(ctx);
    const result = await analyzeAgencyRisks({ db: ctx.db, agencyId });
    return result;
  }),

  // ─── Risk history/trends (last 7 analyses) ───
  trends: adminProcedure.query(async ({ ctx }) => {
    const agencyId = getAgencyId(ctx);

    // Get current assessment counts by level
    const counts = await ctx.db.riskAssessment.groupBy({
      by: ["riskLevel"],
      where: { agencyId },
      _count: true,
    });

    return {
      byLevel: counts.map((c) => ({
        level: c.riskLevel,
        count: c._count,
      })),
    };
  }),
});
