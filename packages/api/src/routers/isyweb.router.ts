import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  isywebProcedure,
  isywebAdminProcedure,
  getAgencyId,
} from "../trpc";
import { chatCompletion } from "../lib/openrouter";
import {
  BROCHURE_FIELD_DEFS,
  BROCHURE_INITIAL_QUESTION,
  MAX_AI_QUESTIONS,
  buildBrochureSystemPrompt,
} from "../lib/isyweb-brochure";

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

// Shared access guard — multitenant + cliente time-bound + cliente ownership
async function assertProjectAccess(ctx: any, projectId: string) {
  const project = await ctx.db.isywebProject.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" });
  }
  const agencyId = getAgencyId(ctx);
  if (project.agencyId !== agencyId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  if (ctx.session.user.role === "CLIENTE") {
    const cp = await ctx.db.clientProfile.findUnique({
      where: { userId: ctx.session.user.id },
      select: { id: true },
    });
    if (!cp || project.clientId !== cp.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    if (project.clientAccessExpiresAt && project.clientAccessExpiresAt < new Date()) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "El acceso al proyecto ha expirado",
      });
    }
  }
  return project;
}

export const isywebRouter = router({
  // ── Projects ──

  list: isywebProcedure
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

  getById: isywebProcedure
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

  create: isywebAdminProcedure
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

  update: isywebAdminProcedure
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

  archive: isywebAdminProcedure
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

  addPage: isywebAdminProcedure
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

  assignColaborador: isywebAdminProcedure
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

  unassignColaborador: isywebAdminProcedure
    .input(z.object({ assignmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.isywebProjectAssignment.delete({
        where: { id: input.assignmentId },
      });
    }),

  // ── BROCHURE (briefing with AI assistance or manual) ──

  brochureGet: isywebProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await assertProjectAccess(ctx, input.projectId);

      const session = await ctx.db.isywebBrochureSession.findUnique({
        where: { projectId: project.id },
        include: {
          questions: { orderBy: { order: "asc" } },
          fields: { orderBy: { updatedAt: "asc" } },
        },
      });

      return {
        session,
        fieldDefs: BROCHURE_FIELD_DEFS,
      };
    }),

  brochureStart: isywebProcedure
    .input(
      z.object({
        projectId: z.string(),
        mode: z.enum(["AI_ASSISTED", "MANUAL"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await assertProjectAccess(ctx, input.projectId);

      const session = await ctx.db.isywebBrochureSession.upsert({
        where: { projectId: project.id },
        create: {
          projectId: project.id,
          mode: input.mode,
          status: "active",
          // Seed first AI question if AI mode
          ...(input.mode === "AI_ASSISTED" && {
            questions: {
              create: {
                order: 0,
                question: BROCHURE_INITIAL_QUESTION,
              },
            },
          }),
        },
        update: { mode: input.mode, status: "active" },
        include: {
          questions: { orderBy: { order: "asc" } },
          fields: true,
        },
      });

      // Move project to BROCHURE state if still DRAFT
      if (project.status === "DRAFT") {
        await ctx.db.isywebProject.update({
          where: { id: project.id },
          data: { status: "BROCHURE" },
        });
      }

      return session;
    }),

  brochureAnswer: isywebProcedure
    .input(
      z.object({
        sessionId: z.string(),
        questionId: z.string(),
        answer: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.isywebBrochureSession.findUnique({
        where: { id: input.sessionId },
        include: {
          project: true,
          questions: { orderBy: { order: "asc" } },
          fields: true,
        },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      await assertProjectAccess(ctx, session.projectId);

      // Save the user's answer
      await ctx.db.isywebBrochureQuestion.update({
        where: { id: input.questionId },
        data: { answer: input.answer },
      });

      const askedCount = session.questions.length;
      const filledState: Record<string, any> = Object.fromEntries(
        session.fields.map((f) => [f.key, f.value])
      );

      // Stop after MAX questions even if AI wants more
      if (askedCount >= MAX_AI_QUESTIONS) {
        return { done: true, nextQuestion: null, extractedFields: [], summary: null };
      }

      // Build conversation history for the LLM
      const history: Array<{ role: "user" | "assistant"; content: string }> = [];
      for (const q of session.questions) {
        history.push({ role: "assistant", content: q.question });
        if (q.id === input.questionId) {
          history.push({ role: "user", content: input.answer });
        } else if (q.answer) {
          history.push({ role: "user", content: q.answer });
        }
      }

      const llmResponse = await chatCompletion({
        db: ctx.db as any,
        messages: [
          { role: "system", content: buildBrochureSystemPrompt(filledState) },
          ...history,
        ],
        maxTokens: 600,
        temperature: 0.6,
      });

      let parsed: {
        next_question?: string | null;
        extracted_fields?: Array<{ key: string; value: any }>;
        done?: boolean;
        summary_for_user?: string;
      } = {};
      try {
        if (llmResponse) {
          const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("[isyweb brochure] failed to parse LLM JSON", e);
      }

      // Persist extracted fields
      const extracted = (parsed.extracted_fields ?? []).filter(
        (f) => BROCHURE_FIELD_DEFS.some((def) => def.key === f.key)
      );
      for (const f of extracted) {
        const def = BROCHURE_FIELD_DEFS.find((d) => d.key === f.key)!;
        await ctx.db.isywebBrochureField.upsert({
          where: { sessionId_key: { sessionId: session.id, key: f.key } },
          create: {
            sessionId: session.id,
            key: f.key,
            label: def.label,
            value: f.value,
            source: "ai",
          },
          update: { value: f.value, source: "ai" },
        });
      }

      // Persist next question
      let createdQuestion = null;
      if (parsed.next_question && !parsed.done) {
        createdQuestion = await ctx.db.isywebBrochureQuestion.create({
          data: {
            sessionId: session.id,
            order: askedCount,
            question: parsed.next_question,
          },
        });
      }

      // Mark complete if LLM says done
      if (parsed.done) {
        await ctx.db.isywebBrochureSession.update({
          where: { id: session.id },
          data: { status: "completed" },
        });
        await ctx.db.isywebProject.update({
          where: { id: session.projectId },
          data: { status: "IN_DEVELOPMENT" },
        });
      }

      return {
        done: !!parsed.done,
        nextQuestion: createdQuestion,
        extractedFields: extracted,
        summary: parsed.summary_for_user ?? null,
      };
    }),

  brochureSetField: isywebProcedure
    .input(
      z.object({
        projectId: z.string(),
        key: z.string(),
        value: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await assertProjectAccess(ctx, input.projectId);

      const def = BROCHURE_FIELD_DEFS.find((d) => d.key === input.key);
      if (!def) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Campo desconocido: ${input.key}`,
        });
      }

      let session = await ctx.db.isywebBrochureSession.findUnique({
        where: { projectId: project.id },
      });
      if (!session) {
        session = await ctx.db.isywebBrochureSession.create({
          data: { projectId: project.id, mode: "MANUAL", status: "active" },
        });
        if (project.status === "DRAFT") {
          await ctx.db.isywebProject.update({
            where: { id: project.id },
            data: { status: "BROCHURE" },
          });
        }
      }

      const isClient = ctx.session.user.role === "CLIENTE";
      return ctx.db.isywebBrochureField.upsert({
        where: { sessionId_key: { sessionId: session.id, key: input.key } },
        create: {
          sessionId: session.id,
          key: input.key,
          label: def.label,
          value: input.value,
          source: isClient ? "client" : "admin",
        },
        update: { value: input.value, source: isClient ? "client" : "admin" },
      });
    }),

  brochureComplete: isywebProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await assertProjectAccess(ctx, input.projectId);
      const session = await ctx.db.isywebBrochureSession.findUnique({
        where: { projectId: project.id },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.isywebBrochureSession.update({
        where: { id: session.id },
        data: { status: "completed" },
      });
      await ctx.db.isywebProject.update({
        where: { id: project.id },
        data: { status: "IN_DEVELOPMENT" },
      });
      return { ok: true };
    }),

  // ── ANNOTATIONS (Phase 3 — visual review) ──

  annotationsList: isywebProcedure
    .input(
      z.object({
        projectId: z.string(),
        revisionId: z.string().optional(),
        viewport: z.enum(["DESKTOP", "TABLET", "MOBILE"]).optional(),
        pageUrl: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx, input.projectId);
      return ctx.db.isywebAnnotation.findMany({
        where: {
          projectId: input.projectId,
          ...(input.revisionId && { revisionId: input.revisionId }),
          ...(input.viewport && { viewport: input.viewport }),
          ...(input.pageUrl && { pageUrl: input.pageUrl }),
        },
        include: {
          comments: { orderBy: { createdAt: "asc" } },
          task: { select: { id: true, taskNumber: true, status: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  annotationCreate: isywebProcedure
    .input(
      z.object({
        projectId: z.string(),
        revisionId: z.string(),
        type: z.enum([
          "PIN",
          "PRIORITY",
          "POSTIT",
          "EMOJI",
          "CAPTURE",
          "ARROW",
          "CIRCLE",
          "RECTANGLE",
          "FREEHAND",
          "HIGHLIGHT",
          "TEXT",
        ]),
        pageUrl: z.string(),
        viewport: z.enum(["DESKTOP", "TABLET", "MOBILE"]).default("DESKTOP"),
        domSelector: z.string().optional(),
        domXPath: z.string().optional(),
        domTextSnippet: z.string().optional(),
        x: z.number(),
        y: z.number(),
        width: z.number().optional(),
        height: z.number().optional(),
        text: z.string().optional(),
        emoji: z.string().optional(),
        priorityLevel: z.number().int().min(1).max(3).optional(),
        pathData: z.any().optional(),
        color: z.string().default("#ef4444"),
        strokeWidth: z.number().int().default(3),
        pageId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectAccess(ctx, input.projectId);
      return ctx.db.isywebAnnotation.create({
        data: {
          ...input,
          authorId: ctx.session.user.id,
        },
      });
    }),

  annotationUpdate: isywebProcedure
    .input(
      z.object({
        id: z.string(),
        x: z.number().optional(),
        y: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        text: z.string().optional(),
        color: z.string().optional(),
        status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ann = await ctx.db.isywebAnnotation.findUnique({
        where: { id: input.id },
      });
      if (!ann) throw new TRPCError({ code: "NOT_FOUND" });
      await assertProjectAccess(ctx, ann.projectId);

      const { id, ...rest } = input;
      const data: any = { ...rest };
      if (rest.status === "RESOLVED") {
        data.resolvedAt = new Date();
        data.resolvedBy = ctx.session.user.id;
      }
      return ctx.db.isywebAnnotation.update({ where: { id }, data });
    }),

  annotationDelete: isywebProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ann = await ctx.db.isywebAnnotation.findUnique({
        where: { id: input.id },
      });
      if (!ann) throw new TRPCError({ code: "NOT_FOUND" });
      await assertProjectAccess(ctx, ann.projectId);
      return ctx.db.isywebAnnotation.delete({ where: { id: input.id } });
    }),

  // ── REVISIONS (Phase 4) ──

  currentRevision: isywebProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await assertProjectAccess(ctx, input.projectId);
      const latest = await ctx.db.isywebRevision.findFirst({
        where: { projectId: project.id },
        orderBy: { roundNumber: "desc" },
      });
      return latest;
    }),

  revisionHistory: isywebProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx, input.projectId);
      return ctx.db.isywebRevision.findMany({
        where: { projectId: input.projectId },
        orderBy: { roundNumber: "asc" },
        include: {
          snapshot: true,
          _count: { select: { annotations: true } },
        },
      });
    }),

  /** Cliente envía la ronda actual al admin para que la trabaje. */
  submitRevision: isywebProcedure
    .input(z.object({ projectId: z.string(), revisionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await assertProjectAccess(ctx, input.projectId);
      const rev = await ctx.db.isywebRevision.findUnique({
        where: { id: input.revisionId },
      });
      if (!rev || rev.projectId !== project.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (rev.status !== "OPEN") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Esta ronda ya fue enviada (estado: ${rev.status})`,
        });
      }
      const annCount = await ctx.db.isywebAnnotation.count({
        where: { revisionId: rev.id },
      });
      if (annCount === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No hay anotaciones en esta ronda. Agrega al menos una.",
        });
      }
      const updated = await ctx.db.isywebRevision.update({
        where: { id: rev.id },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });
      // Move project to IN_REVIEW
      if (project.status !== "IN_REVIEW") {
        await ctx.db.isywebProject.update({
          where: { id: project.id },
          data: { status: "IN_REVIEW" },
        });
      }
      return updated;
    }),

  /** Admin marca la ronda como "en progreso" cuando empieza a trabajar los cambios. */
  startWorkingRevision: isywebAdminProcedure
    .input(z.object({ revisionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rev = await ctx.db.isywebRevision.findUnique({
        where: { id: input.revisionId },
      });
      if (!rev) throw new TRPCError({ code: "NOT_FOUND" });
      await assertProjectAccess(ctx, rev.projectId);
      return ctx.db.isywebRevision.update({
        where: { id: rev.id },
        data: { status: "IN_PROGRESS" },
      });
    }),

  /** Admin marca la ronda como "lista para revisar nuevamente" — el cliente puede aprobar o crear nueva ronda. */
  resolveRevision: isywebAdminProcedure
    .input(z.object({ revisionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rev = await ctx.db.isywebRevision.findUnique({
        where: { id: input.revisionId },
      });
      if (!rev) throw new TRPCError({ code: "NOT_FOUND" });
      const project = await assertProjectAccess(ctx, rev.projectId);
      const updated = await ctx.db.isywebRevision.update({
        where: { id: rev.id },
        data: { status: "RESOLVED" },
      });
      // Project goes back to IN_REVIEW for client final check
      await ctx.db.isywebProject.update({
        where: { id: project.id },
        data: { status: "IN_REVIEW" },
      });
      return updated;
    }),

  /**
   * Cliente aprueba la ronda final → proyecto APPROVED, timestamp legal.
   * El consent text se guarda en el snapshot.htmlSnapshot como auditoría.
   */
  approveRevision: isywebProcedure
    .input(
      z.object({
        revisionId: z.string(),
        consent: z
          .string()
          .min(20, "Confirma con un mensaje claro de aprobación"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rev = await ctx.db.isywebRevision.findUnique({
        where: { id: input.revisionId },
        include: { snapshot: true },
      });
      if (!rev) throw new TRPCError({ code: "NOT_FOUND" });
      const project = await assertProjectAccess(ctx, rev.projectId);
      if (ctx.session.user.role !== "CLIENTE" && ctx.session.user.role !== "ADMIN" && ctx.session.user.role !== "SUPER_ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo el cliente puede aprobar" });
      }

      const now = new Date();
      const auditHtml = `<!-- Isyweb approval audit -->
<approval>
  <project>${project.name} (${project.id})</project>
  <revision>${rev.roundNumber}</revision>
  <approvedBy>${ctx.session.user.id} (${ctx.session.user.email ?? ""})</approvedBy>
  <approvedAt>${now.toISOString()}</approvedAt>
  <consent>${input.consent.replace(/[<>]/g, "")}</consent>
</approval>`;

      const updated = await ctx.db.isywebRevision.update({
        where: { id: rev.id },
        data: {
          status: "APPROVED",
          approvedAt: now,
          approvedBy: ctx.session.user.id,
        },
      });

      // Persist consent into snapshot (create if missing)
      if (rev.snapshot) {
        await ctx.db.isywebSnapshot.update({
          where: { revisionId: rev.id },
          data: { htmlSnapshot: auditHtml },
        });
      } else {
        await ctx.db.isywebSnapshot.create({
          data: {
            revisionId: rev.id,
            desktopUrl: "approval://no-snapshot",
            htmlSnapshot: auditHtml,
          },
        });
      }

      // Project APPROVED
      await ctx.db.isywebProject.update({
        where: { id: project.id },
        data: { status: "APPROVED" },
      });

      return updated;
    }),

  /** Cliente abre nueva ronda (pide más cambios). Solo si no se pasó el límite. */
  startNextRound: isywebProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await assertProjectAccess(ctx, input.projectId);
      if (project.currentRound >= project.maxRevisionRounds) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Ya alcanzaste el límite de ${project.maxRevisionRounds} rondas. Contacta a tu agencia para extenderlo.`,
        });
      }
      const nextNumber = project.currentRound + 1;
      const newRev = await ctx.db.isywebRevision.create({
        data: {
          projectId: project.id,
          roundNumber: nextNumber,
          status: "OPEN",
        },
      });
      await ctx.db.isywebProject.update({
        where: { id: project.id },
        data: { currentRound: nextNumber, status: "IN_DEVELOPMENT" },
      });
      return newRev;
    }),

  /**
   * Guarda un snapshot de la ronda. El cliente envía las URLs (capturadas con
   * html2canvas en el navegador, o por Playwright en server cuando esté disponible).
   */
  saveSnapshot: isywebProcedure
    .input(
      z.object({
        revisionId: z.string(),
        desktopUrl: z.string().min(1),
        tabletUrl: z.string().optional(),
        mobileUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rev = await ctx.db.isywebRevision.findUnique({
        where: { id: input.revisionId },
      });
      if (!rev) throw new TRPCError({ code: "NOT_FOUND" });
      await assertProjectAccess(ctx, rev.projectId);
      return ctx.db.isywebSnapshot.upsert({
        where: { revisionId: rev.id },
        create: {
          revisionId: rev.id,
          desktopUrl: input.desktopUrl,
          tabletUrl: input.tabletUrl,
          mobileUrl: input.mobileUrl,
        },
        update: {
          desktopUrl: input.desktopUrl,
          tabletUrl: input.tabletUrl,
          mobileUrl: input.mobileUrl,
        },
      });
    }),

  // Convert annotation → IsyTask task (Phase 5 stub, not wired yet)

  // ── Stats / dashboard widget ──

  stats: isywebProcedure.query(async ({ ctx }) => {
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
