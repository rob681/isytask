import { z } from "zod";
import { hash, compare } from "bcryptjs";
import jwt from "jsonwebtoken";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../trpc";
import {
  validateTokenSchema,
  setupPasswordSchema,
  requestResetSchema,
  resetPasswordSchema,
  registerAgencySchema,
  loginSchema,
} from "@isytask/shared";
import { validateToken, createToken } from "../lib/tokens";
import { sendEmailNotification } from "../lib/email";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";
const JWT_EXPIRES_IN = "30d";

// Rate limiting for password reset requests
const resetRequestCounts = new Map<
  string,
  { count: number; resetAt: number }
>();
const MAX_RESET_REQUESTS = 3;
const RESET_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Rate limiting for registration
const registerRequestCounts = new Map<
  string,
  { count: number; resetAt: number }
>();
const MAX_REGISTER_REQUESTS = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkResetRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = resetRequestCounts.get(email);

  if (!entry || now > entry.resetAt) {
    resetRequestCounts.set(email, {
      count: 1,
      resetAt: now + RESET_WINDOW_MS,
    });
    return true;
  }

  if (entry.count >= MAX_RESET_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

export const authRouter = router({
  /** Mobile login — validates credentials and returns a signed JWT */
  mobileLogin: publicProcedure
    .input(loginSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
        include: {
          clientProfile: { select: { id: true } },
          colaboradorProfile: { select: { id: true, permissions: true } },
        },
      });

      if (!user || !user.isActive) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Credenciales inválidas.",
        });
      }

      // Check agency is active
      if (user.agencyId) {
        const agency = await ctx.db.agency.findUnique({
          where: { id: user.agencyId },
          select: { isActive: true },
        });
        if (agency && !agency.isActive) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Tu agencia ha sido desactivada. Contacta al administrador.",
          });
        }
      }

      if (!user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Debes configurar tu contraseña primero. Revisa tu correo de invitación.",
        });
      }

      const isValid = await compare(input.password, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Credenciales inválidas.",
        });
      }

      // Build JWT payload (same fields as NextAuth session)
      const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        agencyId: user.agencyId ?? undefined,
        clientProfileId: user.clientProfile?.id,
        colaboradorProfileId: user.colaboradorProfile?.id,
        permissions:
          (user.colaboradorProfile?.permissions as string[]) ?? [],
      };

      const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      return { token, user: payload };
    }),

  /** Validate a token (invitation or reset) before showing the form */
  validateToken: publicProcedure
    .input(validateTokenSchema)
    .query(async ({ ctx, input }) => {
      const token = await validateToken(ctx.db, input.token, input.type);
      if (!token) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "El enlace es inválido o ha expirado.",
        });
      }
      return {
        valid: true,
        userName: token.user.name,
        userEmail: token.user.email,
        hasPassword: !!token.user.passwordHash,
      };
    }),

  /** Set password from invitation link */
  setupPassword: publicProcedure
    .input(setupPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const token = await validateToken(ctx.db, input.token, "INVITATION");
      if (!token) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "El enlace de invitación es inválido o ha expirado. Solicita al administrador que te reenvíe la invitación.",
        });
      }

      const passwordHash = await hash(input.password, 12);

      await ctx.db.$transaction([
        ctx.db.user.update({
          where: { id: token.user.id },
          data: { passwordHash },
        }),
        ctx.db.token.update({
          where: { id: token.id },
          data: { usedAt: new Date() },
        }),
      ]);

      return { success: true, email: token.user.email };
    }),

  /** Request a password reset email (always returns success to prevent email enumeration) */
  requestReset: publicProcedure
    .input(requestResetSchema)
    .mutation(async ({ ctx, input }) => {
      // Rate limit check
      if (!checkResetRateLimit(input.email)) {
        return { success: true };
      }

      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          passwordHash: true,
        },
      });

      // Silently succeed if user doesn't exist, is inactive, or has no password
      if (!user || !user.isActive || !user.passwordHash) {
        return { success: true };
      }

      const tokenString = await createToken(
        ctx.db,
        user.id,
        "PASSWORD_RESET"
      );

      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const resetUrl = `${baseUrl}/auth/reset-password?token=${tokenString}`;

      await sendEmailNotification({
        db: ctx.db,
        to: user.email,
        subject: "Restablecer tu contraseña — Isytask",
        title: "Restablecer contraseña",
        body: `Hola ${user.name},<br><br>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva.<br><br>Este enlace expira en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo.`,
        actionUrl: resetUrl,
        actionLabel: "Restablecer contraseña",
      });

      return { success: true };
    }),

  /** Reset password using a valid reset token */
  resetPassword: publicProcedure
    .input(resetPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const token = await validateToken(
        ctx.db,
        input.token,
        "PASSWORD_RESET"
      );
      if (!token) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "El enlace de restablecimiento es inválido o ha expirado. Solicita uno nuevo.",
        });
      }

      const passwordHash = await hash(input.password, 12);

      await ctx.db.$transaction([
        ctx.db.user.update({
          where: { id: token.user.id },
          data: { passwordHash },
        }),
        ctx.db.token.update({
          where: { id: token.id },
          data: { usedAt: new Date() },
        }),
      ]);

      return { success: true, email: token.user.email };
    }),

  /** Public self-service agency registration (SaaS sign-up) */
  registerAgency: publicProcedure
    .input(registerAgencySchema)
    .mutation(async ({ ctx, input }) => {
      // Honeypot check — bots fill hidden fields, humans don't
      if (input.honeypot) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Solicitud inválida.",
        });
      }

      // reCAPTCHA v3 verification
      const recaptchaRes = await fetch(
        "https://www.google.com/recaptcha/api/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${input.recaptchaToken}`,
        }
      );
      const recaptchaData = await recaptchaRes.json() as { success: boolean; score: number };
      if (!recaptchaData.success || recaptchaData.score < 0.5) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Verificación de seguridad fallida. Intenta de nuevo.",
        });
      }

      // Rate limit
      const now = Date.now();
      const entry = registerRequestCounts.get(input.email);
      if (entry && now < entry.resetAt && entry.count >= MAX_REGISTER_REQUESTS) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Demasiados intentos. Intenta de nuevo más tarde.",
        });
      }
      if (!entry || now > (entry?.resetAt ?? 0)) {
        registerRequestCounts.set(input.email, { count: 1, resetAt: now + REGISTER_WINDOW_MS });
      } else {
        entry.count++;
      }

      // Check email uniqueness
      const existingUser = await ctx.db.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este email ya está registrado. Inicia sesión o usa otro email.",
        });
      }

      // Auto-generate slug from agency name
      const baseSlug = input.agencyName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      let slug = baseSlug || "agencia";
      let attempt = 0;
      while (await ctx.db.agency.findUnique({ where: { slug } })) {
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }

      // Hash password
      const passwordHash = await hash(input.password, 12);

      // Create agency + admin in a single transaction
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const result = await ctx.db.$transaction(async (tx) => {
        const agency = await tx.agency.create({
          data: {
            name: input.agencyName,
            slug,
            planTier: "trial",
            maxUsers: 10,
            trialEndsAt,
            billingEmail: input.email,
          },
        });

        const user = await tx.user.create({
          data: {
            email: input.email,
            name: input.adminName,
            passwordHash,
            role: "ADMIN",
            agencyId: agency.id,
          },
        });

        return { agency, user };
      });

      // Send welcome email (non-blocking)
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      sendEmailNotification({
        db: ctx.db,
        to: input.email,
        subject: "Bienvenido a Isytask — Tu agencia está lista",
        title: "¡Bienvenido a Isytask!",
        body: `Hola ${input.adminName},<br><br>Tu agencia <strong>${input.agencyName}</strong> ha sido creada exitosamente. Tu prueba gratuita de 14 días comienza hoy.<br><br>Inicia sesión para empezar a organizar tu equipo y tus clientes.`,
        actionUrl: `${baseUrl}/login`,
        actionLabel: "Iniciar sesión",
      }).catch(console.error);

      return { success: true, email: input.email, slug: result.agency.slug };
    }),
});
