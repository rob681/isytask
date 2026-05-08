import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  protectedProcedure,
  adminProcedure,
  getAgencyId,
} from "../trpc";

const SiteTypeEnum = z.enum([
  "LANDING",
  "ONE_PAGE",
  "MULTI_PAGE",
  "ECOMMERCE",
  "WEBAPP",
  "BLOG",
  "OTHER",
]);

const ProjectStatusEnum = z.enum([
  "DRAFT",
  "BROCHURE",
  "IN_DEVELOPMENT",
  "IN_REVIEW",
  "APPROVED",
  "ARCHIVED",
]);

const EmbedMethodEnum = z.enum(["SCRIPT", "PROXY", "SCREENSHOT"]);

export const isywebRouter = router({
  // ── Projects ──

  list: protectedProcedure
    .input(
      z
        .object({
          status: ProjectStatusEnum.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const agencyId = getAgencyId(ctx);

      // Cliente can only see their own projects
      const where: any = { agencyId };
      if (input?.status) where.status = input.status;

      if (role === "CLIENTE") {
        const clientProfile = await ctx.db.clientProfile.findUnique({
          where: { userId: ctx.session.user.id },
          select: { id: true },
        });
        if (!clientProfile) return [];
        where.clientId = clientProfile.id;
      }

      return ctx.db.isywebProject.findMany({
        where,
        include: {
          _count: {
            select: { pages: true, annotations: true, revisions: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.isywebProject.findUnique({
        where: { id: input.id },
        include: {
          pages: { orderBy: { order: "asc" } },
          revisions: { orderBy: { roundNumber: "desc" } },
          assets: { orderBy: { createdAt: "desc" } },
          assignments: true,
          brochureSession: true,
          _count: { select: { annotations: true } },
        },
      });

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" });
      }

      // Multi-tenant guard
      const agencyId = getAgencyId(ctx);
      if (project.agencyId !== agencyId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Cliente access guard
      if (ctx.session.user.role === "CLIENTE") {
        const clientProfile = await ctx.db.clientProfile.findUnique({
          where: { userId: ctx.session.user.id },
          select: { id: true },
        });
        if (!clientProfile || project.clientId !== clientProfile.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        // Time-bound access enforcement
        if (
          project.clientAccessExpiresAt &&
          project.clientAccessExpiresAt < new Date()
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "El acceso al proyecto ha expirado",
          });
        }
      }

      return project;
    }),

  create: adminProcedure
    .input(
      z.object({
        clientId: z.string(),
        name: z.string().min(2).max(120),
        description: z.string().max(2000).optional(),
        siteType: SiteTypeEnum.optional(),
        devUrl: z.string().url().optional().or(z.literal("")),
        productionUrl: z.string().url().optional().or(z.literal("")),
        embedMethod: EmbedMethodEnum.default("SCRIPT"),
        clientAccessExpiresAt: z.date().optional(),
        maxRevisionRounds: z.number().int().min(1).max(20).default(3),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const agencyId = getAgencyId(ctx);

      // Validate client belongs to same agency
      const client = await ctx.db.clientProfile.findUnique({
        where: { id: input.clientId },
        include: { user: { select: { agencyId: true } } },
      });
      if (!client || client.user.agencyId !== agencyId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cliente inválido",
        });
      }

      return ctx.db.isywebProject.create({
        data: {
          agencyId,
          clientId: input.clientId,
          name: input.name,
          description: input.description,
          siteType: input.siteType,
          devUrl: input.devUrl || null,
          productionUrl: input.productionUrl || null,
          embedMethod: input.embedMethod,
          clientAccessExpiresAt: input.clientAccessExpiresAt,
          maxRevisionRounds: input.maxRevisionRounds,
          createdById: ctx.session.user.id,
          // Auto-create first revision round
          revisions: {
            create: { roundNumber: 1, status: "OPEN" },
          },
        },
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).max(120).optional(),
        description: z.string().max(2000).optional().nullable(),
        siteType: SiteTypeEnum.optional(),
        status: ProjectStatusEnum.optional(),
        devUrl: z.string().url().optional().nullable().or(z.literal("")),
        productionUrl: z.string().url().optional().nullable().or(z.literal("")),
        embedMethod: EmbedMethodEnum.optional(),
        clientAccessExpiresAt: z.date().optional().nullable(),
        maxRevisionRounds: z.number().int().min(1).max(20).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const agencyId = getAgencyId(ctx);
      const { id, ...rest } = input;
      const project = await ctx.db.isywebProject.findUnique({ where: { id } });
      if (!project || project.agencyId !== agencyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const data: any = { ...rest };
      if (data.devUrl === "") data.devUrl = null;
      if (data.productionUrl === "") data.productionUrl = null;

      return ctx.db.isywebProject.update({ where: { id }, data });
    }),

  archive: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const agencyId = getAgencyId(ctx);
      const project = await ctx.db.isywebProject.findUnique({
        where: { id: input.id },
      });
      if (!project || project.agencyId !== agencyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return ctx.db.isywebProject.update({
        where: { id: input.id },
        data: { status: "ARCHIVED" },
      });
    }),

  // ── Pages ──

  addPage: adminProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(80),
        description: z.string().max(1000).optional(),
        order: z.number().int().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const agencyId = getAgencyId(ctx);
      const project = await ctx.db.isywebProject.findUnique({
        where: { id: input.projectId },
      });
      if (!project || project.agencyId !== agencyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return ctx.db.isywebPage.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          description: input.description,
          order: input.order,
        },
      });
    }),

  // ── Project assignments (colaboradores) ──

  assignColaborador: adminProcedure
    .input(
      z.object({
        projectId: z.string(),
        colaboradorId: z.string(),
        role: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const agencyId = getAgencyId(ctx);
      const project = await ctx.db.isywebProject.findUnique({
        where: { id: input.projectId },
      });
      if (!project || project.agencyId !== agencyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return ctx.db.isywebProjectAssignment.upsert({
        where: {
          projectId_colaboradorId: {
            projectId: input.projectId,
            colaboradorId: input.colaboradorId,
          },
        },
        create: {
          projectId: input.projectId,
          colaboradorId: input.colaboradorId,
          role: input.role,
        },
        update: { role: input.role },
      });
    }),

  unassignColaborador: adminProcedure
    .input(z.object({ assignmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.isywebProjectAssignment.delete({
        where: { id: input.assignmentId },
      });
    }),

  // ── Stats / dashboard widget ──

  stats: protectedProcedure.query(async ({ ctx }) => {
    const agencyId = getAgencyId(ctx);
    const [total, inDev, inReview, approved] = await Promise.all([
      ctx.db.isywebProject.count({ where: { agencyId } }),
      ctx.db.isywebProject.count({
        where: { agencyId, status: "IN_DEVELOPMENT" },
      }),
      ctx.db.isywebProject.count({ where: { agencyId, status: "IN_REVIEW" } }),
      ctx.db.isywebProject.count({ where: { agencyId, status: "APPROVED" } }),
    ]);
    return { total, inDev, inReview, approved };
  }),
});
