import { z } from "zod";
import { compare, hash } from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { adminProcedure, adminOrPermissionProcedure, protectedProcedure, router, getAgencyId } from "../trpc";
import { createUserSchema, updateUserSchema, changePasswordSchema, ALL_PERMISSIONS } from "@isytask/shared";
import { createToken } from "../lib/tokens";
import { sendEmailNotification } from "../lib/email";
import { audit } from "../lib/audit";

const teamProcedure = adminOrPermissionProcedure("manage_team");

export const usersRouter = router({
  list: teamProcedure
    .input(
      z.object({
        role: z.enum(["ADMIN", "COLABORADOR", "CLIENTE"]).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const agencyId = getAgencyId(ctx);
      const where = {
        agencyId,
        ...(input.role && { role: input.role }),
        ...(input.search && {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } },
          ],
        }),
      };

      const [rawUsers, total] = await Promise.all([
        ctx.db.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            avatarUrl: true,
            createdAt: true,
            passwordHash: true,
            clientProfile: {
              select: {
                id: true,
                companyName: true,
                monthlyTaskLimit: true,
                revisionLimitPerTask: true,
              },
            },
            colaboradorProfile: {
              select: {
                id: true,
                specialty: true,
                permissions: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.user.count({ where }),
      ]);

      // Map passwordHash to hasPassword boolean (never send hash to frontend)
      const users = rawUsers.map(({ passwordHash, ...rest }) => ({
        ...rest,
        hasPassword: !!passwordHash,
      }));

      return { users, total, pages: Math.ceil(total / input.pageSize) };
    }),

  getById: teamProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const agencyId = getAgencyId(ctx);
      return ctx.db.user.findFirstOrThrow({
        where: { id: input.id, agencyId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          avatarUrl: true,
          createdAt: true,
          clientProfile: {
            select: {
              id: true,
              companyName: true,
              logoUrl: true,
              monthlyTaskLimit: true,
              revisionLimitPerTask: true,
            },
          },
          colaboradorProfile: {
            select: {
              id: true,
              specialty: true,
              permissions: true,
              assignedClients: {
                select: {
                  client: {
                    select: {
                      id: true,
                      companyName: true,
                      user: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
    }),

  create: teamProcedure
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Create user WITHOUT password — they'll set it via invitation link
      const agencyId = getAgencyId(ctx);

      // Check if email is already taken before attempting create
      const existing = await ctx.db.user.findUnique({
        where: { email: input.email },
        select: { id: true, agencyId: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este correo electrónico ya está registrado en la plataforma. Usa otro email para invitar a este usuario.",
        });
      }

      const user = await ctx.db.user.create({
        data: {
          email: input.email,
          name: input.name,
          phone: input.phone,
          role: input.role,
          agencyId,
          ...(input.role === "CLIENTE" && {
            clientProfile: {
              create: {
                monthlyTaskLimit: 10,
                revisionLimitPerTask: 3,
              },
            },
          }),
          ...(input.role === "COLABORADOR" && {
            colaboradorProfile: {
              create: {},
            },
          }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      // Generate invitation token and send email
      const tokenString = await createToken(ctx.db, user.id, "INVITATION");
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const invitationUrl = `${baseUrl}/auth/setup-password?token=${tokenString}`;

      await sendEmailNotification({
        db: ctx.db,
        to: user.email,
        subject: "Has sido invitado a Isytask",
        title: "Bienvenido a Isytask",
        body: `Hola ${user.name},<br><br>Has sido invitado a unirte a Isytask como <strong>${user.role === "CLIENTE" ? "Cliente" : user.role === "COLABORADOR" ? "Colaborador" : "Administrador"}</strong>. Haz clic en el botón de abajo para configurar tu contraseña y acceder a la plataforma.<br><br>Este enlace expira en 48 horas.`,
        actionUrl: invitationUrl,
        actionLabel: "Configurar mi contraseña",
      }).catch((err) => {
        console.error("[Invitation] Email failed:", err);
      });

      return user;
    }),

  resendInvitation: teamProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: { id: true, email: true, name: true, passwordHash: true, role: true },
      });

      if (user.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El usuario ya ha configurado su contraseña.",
        });
      }

      const tokenString = await createToken(ctx.db, user.id, "INVITATION");
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const invitationUrl = `${baseUrl}/auth/setup-password?token=${tokenString}`;

      await sendEmailNotification({
        db: ctx.db,
        to: user.email,
        subject: "Invitación a Isytask (reenvío)",
        title: "Invitación a Isytask",
        body: `Hola ${user.name},<br><br>Se te ha reenviado la invitación a Isytask. Haz clic en el botón de abajo para configurar tu contraseña.<br><br>Este enlace expira en 48 horas.`,
        actionUrl: invitationUrl,
        actionLabel: "Configurar mi contraseña",
      });

      return { success: true };
    }),

  update: teamProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
        },
      });
    }),

  deactivate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: input.id },
        data: { isActive: false },
        select: { id: true, isActive: true },
      });
    }),

  // Any authenticated user: get own profile
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        avatarUrl: true,
      },
    });
  }),

  // Any authenticated user: update own profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        avatarUrl: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: input,
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      });
    }),

  // Any authenticated user: change own password
  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: ctx.session.user.id },
        select: { passwordHash: true },
      });

      if (!user.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tu cuenta no tiene contraseña configurada. Usa el enlace de invitación.",
        });
      }

      const isValid = await compare(input.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "La contraseña actual es incorrecta.",
        });
      }

      const newHash = await hash(input.newPassword, 12);
      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { passwordHash: newHash },
      });

      audit(ctx.db, {
        userId: ctx.session.user.id,
        agencyId: ctx.session.user.agencyId,
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: ctx.session.user.id,
      });

      return { success: true };
    }),

  // Admin: toggle user active status
  toggleActive: adminProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      // Prevent admin from deactivating themselves
      if (input.id === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No puedes desactivar tu propia cuenta.",
        });
      }
      return ctx.db.user.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
        select: { id: true, isActive: true, name: true },
      });
    }),

  // Only real ADMIN can update permissions
  updatePermissions: adminProcedure
    .input(
      z.object({
        colaboradorProfileId: z.string(),
        permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.colaboradorProfile.update({
        where: { id: input.colaboradorProfileId },
        data: { permissions: input.permissions },
        select: { id: true, permissions: true },
      });
    }),
});
