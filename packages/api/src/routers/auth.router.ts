import { z } from "zod";
import { hash } from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../trpc";
import {
  validateTokenSchema,
  setupPasswordSchema,
  requestResetSchema,
  resetPasswordSchema,
} from "@isytask/shared";
import { validateToken, createToken } from "../lib/tokens";
import { sendEmailNotification } from "../lib/email";

// Rate limiting for password reset requests
const resetRequestCounts = new Map<
  string,
  { count: number; resetAt: number }
>();
const MAX_RESET_REQUESTS = 3;
const RESET_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

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
});
