import { z } from "zod";
import { router, adminProcedure, protectedProcedure } from "../trpc";

export const whatsappRouter = router({
  // ─── List all WhatsApp contacts ───
  listContacts: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        onlyLinked: z.boolean().optional(),
        page: z.number().min(1).default(1),
        perPage: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, onlyLinked, page, perPage } = input;
      const skip = (page - 1) * perPage;

      const where: any = {};
      if (search) {
        where.OR = [
          { phone: { contains: search } },
          { displayName: { contains: search, mode: "insensitive" } },
          { user: { name: { contains: search, mode: "insensitive" } } },
          {
            client: {
              companyName: { contains: search, mode: "insensitive" },
            },
          },
        ];
      }
      if (onlyLinked) {
        where.clientId = { not: null };
      }

      const [contacts, total] = await Promise.all([
        ctx.db.whatsAppContact.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true } },
            client: { select: { id: true, companyName: true } },
            _count: { select: { messages: true } },
          },
          orderBy: { lastMessageAt: "desc" },
          skip,
          take: perPage,
        }),
        ctx.db.whatsAppContact.count({ where }),
      ]);

      return { contacts, total, pages: Math.ceil(total / perPage) };
    }),

  // ─── Link a contact to a client ───
  linkContact: adminProcedure
    .input(
      z.object({
        contactId: z.string(),
        clientId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.whatsAppContact.update({
        where: { id: input.contactId },
        data: {
          clientId: input.clientId,
          userId: input.userId,
          isVerified: true,
        },
      });
    }),

  // ─── Unlink a contact ───
  unlinkContact: adminProcedure
    .input(z.object({ contactId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.whatsAppContact.update({
        where: { id: input.contactId },
        data: {
          clientId: null,
          userId: null,
          isVerified: false,
        },
      });
    }),

  // ─── Register a new contact manually ───
  createContact: adminProcedure
    .input(
      z.object({
        phone: z.string().regex(/^\+\d{10,15}$/, "Formato E.164 requerido (ej: +521234567890)"),
        clientId: z.string(),
        userId: z.string(),
        displayName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.whatsAppContact.upsert({
        where: { phone: input.phone },
        create: {
          phone: input.phone,
          clientId: input.clientId,
          userId: input.userId,
          displayName: input.displayName,
          isVerified: true,
          isActive: true,
        },
        update: {
          clientId: input.clientId,
          userId: input.userId,
          displayName: input.displayName,
          isVerified: true,
          isActive: true,
        },
      });
    }),

  // ─── Toggle contact active status ───
  toggleActive: adminProcedure
    .input(z.object({ contactId: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.whatsAppContact.update({
        where: { id: input.contactId },
        data: { isActive: input.isActive },
      });
    }),

  // ─── Get message history for a contact ───
  getMessages: adminProcedure
    .input(
      z.object({
        contactId: z.string(),
        page: z.number().min(1).default(1),
        perPage: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.perPage;

      const [messages, total] = await Promise.all([
        ctx.db.whatsAppMessage.findMany({
          where: { contactId: input.contactId },
          include: {
            matchedTask: {
              select: { id: true, taskNumber: true, title: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: input.perPage,
        }),
        ctx.db.whatsAppMessage.count({
          where: { contactId: input.contactId },
        }),
      ]);

      return { messages, total, pages: Math.ceil(total / input.perPage) };
    }),

  // ─── Dashboard stats ───
  stats: adminProcedure.query(async ({ ctx }) => {
    const [
      totalContacts,
      linkedContacts,
      totalMessages,
      matchedMessages,
      unmatchedMessages,
      todayMessages,
    ] = await Promise.all([
      ctx.db.whatsAppContact.count(),
      ctx.db.whatsAppContact.count({ where: { clientId: { not: null } } }),
      ctx.db.whatsAppMessage.count({ where: { direction: "inbound" } }),
      ctx.db.whatsAppMessage.count({
        where: { status: "COMMENT_CREATED" },
      }),
      ctx.db.whatsAppMessage.count({ where: { status: "UNMATCHED" } }),
      ctx.db.whatsAppMessage.count({
        where: {
          direction: "inbound",
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    return {
      totalContacts,
      linkedContacts,
      totalMessages,
      matchedMessages,
      unmatchedMessages,
      matchRate:
        totalMessages > 0
          ? Math.round((matchedMessages / totalMessages) * 100)
          : 0,
      todayMessages,
    };
  }),

  // ─── Recent unmatched messages (for admin review) ───
  unmatchedMessages: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.whatsAppMessage.findMany({
        where: { status: "UNMATCHED" },
        include: {
          contact: {
            select: {
              phone: true,
              displayName: true,
              client: { select: { companyName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  // ─── Manually match an unmatched message to a task ───
  manualMatch: adminProcedure
    .input(
      z.object({
        messageId: z.string(),
        taskId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.whatsAppMessage.findUnique({
        where: { id: input.messageId },
        include: {
          contact: {
            include: {
              client: { select: { userId: true } },
            },
          },
        },
      });

      if (!message) throw new Error("Mensaje no encontrado");
      if (!message.contact.client)
        throw new Error("Contacto no vinculado a un cliente");

      const task = await ctx.db.task.findUnique({
        where: { id: input.taskId },
        include: {
          client: { select: { userId: true } },
          service: { select: { name: true } },
        },
      });

      if (!task) throw new Error("Tarea no encontrada");

      // Create comment
      const comment = await ctx.db.taskComment.create({
        data: {
          taskId: input.taskId,
          authorId: message.contact.client.userId,
          content: `[WhatsApp] ${message.body}`,
          isQuestion: false,
        },
      });

      // Update message
      await ctx.db.whatsAppMessage.update({
        where: { id: input.messageId },
        data: {
          status: "COMMENT_CREATED",
          matchedTaskId: input.taskId,
          commentId: comment.id,
          aiConfidence: 1.0,
          aiReasoning: "Vinculación manual por administrador",
        },
      });

      return { comment, task };
    }),
});
