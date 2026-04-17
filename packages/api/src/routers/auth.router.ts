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
import { audit } from "../lib/audit";
import { checkRateLimit, cleanupExpiredRateLimits } from "../lib/rate-limit";

const JWT_SECRET = process.env.NEXTAUTH_SECRET;
if (!JWT_SECRET) throw new Error("NEXTAUTH_SECRET is required");
const JWT_EXPIRES_IN = "30d";

const MAX_RESET_REQUESTS = 3;
const RESET_WINDOW_MS = 15 * 60 * 1000;    // 15 minutes
const MAX_REGISTER_REQUESTS = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const authRouter = router({
  /** Diagnostic: Check if Resend is configured (PUBLIC for debugging) */
  diagnosticCheckResend: publicProcedure.query(async ({ ctx }) => {
    try {
      // Check if Resend is configured
      const apiKey = await (ctx.db as any).platformConfig.findUnique({
        where: { key: "resend_api_key" },
      });
      const fromAddress = await (ctx.db as any).platformConfig.findUnique({
        where: { key: "email_from_address" },
      });

      return {
        success: true,
        resendConfigured: {
          hasApiKey: !!apiKey?.value,
          apiKeyLength: apiKey?.value?.length || 0,
          apiKeyStart: apiKey?.value ? apiKey.value.substring(0, 10) + "..." : "N/A",
          hasFromAddress: !!fromAddress?.value,
          fromAddress: fromAddress?.value || "NOT SET",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }),

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

      audit(ctx.db, {
        userId: token.user.id,
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: token.user.id,
        newValue: { source: "invitation_setup" },
      });

      return { success: true, email: token.user.email };
    }),

  /** Request a password reset email (always returns success to prevent email enumeration) */
  requestReset: publicProcedure
    .input(requestResetSchema)
    .mutation(async ({ ctx, input }) => {
      // DB-backed rate limit (survives server restarts)
      const allowed = await checkRateLimit(
        ctx.db,
        `reset:${input.email.toLowerCase()}`,
        MAX_RESET_REQUESTS,
        RESET_WINDOW_MS
      );
      if (!allowed) return { success: true }; // Silently succeed to prevent timing attacks

      // Opportunistic cleanup of expired records (~5%)
      if (Math.random() < 0.05) cleanupExpiredRateLimits(ctx.db);

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
          data: { passwordHash, loginAttempts: 0, lockedUntil: null },
        }),
        ctx.db.token.update({
          where: { id: token.id },
          data: { usedAt: new Date() },
        }),
      ]);

      audit(ctx.db, {
        userId: token.user.id,
        action: "PASSWORD_RESET_COMPLETED",
        entityType: "User",
        entityId: token.user.id,
      });

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

      // reCAPTCHA v3 verification (skip for test tokens in development)
      if (input.recaptchaToken !== "temp-test-token-for-debugging") {
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
      }

      // DB-backed rate limit
      const registerAllowed = await checkRateLimit(
        ctx.db,
        `register:${input.email.toLowerCase()}`,
        MAX_REGISTER_REQUESTS,
        REGISTER_WINDOW_MS
      );
      if (!registerAllowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Demasiados intentos. Intenta de nuevo más tarde.",
        });
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
            emailVerified: false, // Must verify email before first login
          },
        });

        return { agency, user };
      });

      // Create email verification token + send verification email
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const verifyToken = await createToken(ctx.db, result.user.id, "EMAIL_VERIFICATION");
      const verifyUrl = `${baseUrl}/verificar-email?token=${verifyToken}`;

      let emailSent = true;
      try {
        emailSent = await sendEmailNotification({
          db: ctx.db,
          to: input.email,
          subject: "Verifica tu correo — Isytask",
          title: "Confirma tu correo electrónico",
          body: `Hola ${input.adminName},<br><br>Tu agencia <strong>${input.agencyName}</strong> fue creada. Solo falta verificar tu correo para activar tu cuenta y comenzar tu prueba gratuita de 14 días.<br><br>Este enlace expira en 24 horas.`,
          actionUrl: verifyUrl,
          actionLabel: "Verificar correo",
        });
      } catch (error) {
        console.error("Email send failed during signup:", error);
        // User registration succeeds even if email fails, but we track the failure
        emailSent = false;
      }

      audit(ctx.db, {
        userId: result.user.id,
        agencyId: result.agency.id,
        action: "USER_CREATED",
        entityType: "User",
        entityId: result.user.id,
        newValue: { email: input.email, agencyName: input.agencyName },
      });

      return { success: true, email: input.email, slug: result.agency.slug, emailSent };
    }),

  /** Verify email address from link in verification email */
  verifyEmail: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const token = await validateToken(ctx.db, input.token, "EMAIL_VERIFICATION");
      if (!token) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "El enlace de verificación es inválido o ha expirado. Solicita uno nuevo desde el login.",
        });
      }

      await ctx.db.$transaction([
        ctx.db.user.update({
          where: { id: token.user.id },
          data: { emailVerified: true, emailVerifiedAt: new Date() },
        }),
        ctx.db.token.update({
          where: { id: token.id },
          data: { usedAt: new Date() },
        }),
      ]);

      audit(ctx.db, {
        userId: token.user.id,
        action: "USER_CREATED",
        entityType: "User",
        entityId: token.user.id,
        newValue: { emailVerified: true },
      });

      return { success: true, email: token.user.email };
    }),

  /** Resend verification email — for users stuck on unverified state */
  resendVerification: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      // Always return success to prevent email enumeration
      const allowed = await checkRateLimit(
        ctx.db,
        `verify-resend:${input.email.toLowerCase()}`,
        3,
        60 * 60 * 1000 // 3 per hour
      );
      if (!allowed) return { success: true };

      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
        select: { id: true, name: true, emailVerified: true },
      });

      if (!user || user.emailVerified) return { success: true };

      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const verifyToken = await createToken(ctx.db, user.id, "EMAIL_VERIFICATION");
      const verifyUrl = `${baseUrl}/verificar-email?token=${verifyToken}`;

      sendEmailNotification({
        db: ctx.db,
        to: input.email,
        subject: "Verifica tu correo — Isytask",
        title: "Confirma tu correo electrónico",
        body: `Hola ${user.name},<br><br>Solicitaste reenviar el enlace de verificación. Haz clic en el botón para activar tu cuenta.<br><br>Este enlace expira en 24 horas.`,
        actionUrl: verifyUrl,
        actionLabel: "Verificar correo",
      }).catch(console.error);

      return { success: true };
    }),
});
