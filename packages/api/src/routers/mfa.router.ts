/**
 * MFA / TOTP Router
 *
 * Allows ADMIN and SUPER_ADMIN users to enable two-factor authentication
 * using any TOTP app (Google Authenticator, Authy, 1Password, etc.).
 *
 * Flow:
 *  1. setupMfa()     → generates a secret, returns QR code URL (not saved yet)
 *  2. confirmMfa()   → verifies first TOTP code, persists secret + enables MFA
 *  3. disableMfa()   → verifies current TOTP code, removes secret
 *  4. verifyMfa()    → verifies TOTP code during login (called from login flow)
 *  5. getMfaStatus() → returns whether MFA is enabled for the current user
 */

import { z } from "zod";
import * as OTPAuth from "otpauth";
import { TokenType } from "@isytask/db";
import { protectedProcedure, router } from "../trpc";
import { TRPCError } from "@trpc/server";
import { audit } from "../lib/audit";

const APP_NAME = "Isytask";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createTOTP(secret: string, email: string) {
  return new OTPAuth.TOTP({
    issuer: APP_NAME,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

function generateSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function verifyCode(secret: string, email: string, token: string): boolean {
  const totp = createTOTP(secret, email);
  const delta = totp.validate({ token, window: 1 }); // ±30s tolerance
  return delta !== null;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const mfaRouter = router({
  /** Returns whether MFA is currently enabled for the logged-in user */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { mfaEnabled: true },
    });
    return { mfaEnabled: user?.mfaEnabled ?? false };
  }),

  /**
   * Step 1 of MFA setup: generates a new TOTP secret and returns
   * an otpauth:// URI to display as a QR code on the frontend.
   * The secret is NOT saved until confirmMfa() is called.
   */
  setupMfa: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { email: true, mfaEnabled: true },
    });

    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    if (user.mfaEnabled) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "MFA ya está activado. Desactívalo primero para reconfigurarlo.",
      });
    }

    const secret = generateSecret();
    const totp = createTOTP(secret, user.email);
    const otpauthUrl = totp.toString();

    // Store the pending secret temporarily in the token table so we don't leak
    // it in the session. It only becomes permanent after confirmMfa().
    await ctx.db.token.deleteMany({
      where: { userId: ctx.session.user.id, type: "MFA_SETUP" as any },
    });
    await ctx.db.token.create({
      data: {
        token: secret,
        type: TokenType.MFA_SETUP,
        userId: ctx.session.user.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min to complete setup
      },
    });

    return { otpauthUrl, secret };
  }),

  /**
   * Step 2: Verify the first TOTP code from the authenticator app.
   * Only if it matches, we persist the secret and enable MFA.
   */
  confirmMfa: protectedProcedure
    .input(z.object({ code: z.string().length(6, "Código debe tener 6 dígitos") }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { email: true, mfaEnabled: true },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      // Retrieve the pending secret
      const pendingToken = await ctx.db.token.findFirst({
        where: {
          userId: ctx.session.user.id,
          type: TokenType.MFA_SETUP,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!pendingToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No hay configuración de MFA pendiente. Inicia el proceso desde el principio.",
        });
      }

      const isValid = verifyCode(pendingToken.token, user.email, input.code);
      if (!isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Código incorrecto. Verifica que el reloj de tu app esté sincronizado.",
        });
      }

      // Persist the secret and enable MFA
      await ctx.db.$transaction([
        ctx.db.user.update({
          where: { id: ctx.session.user.id },
          data: { mfaEnabled: true, totpSecret: pendingToken.token },
        }),
        // Mark the pending token as used
        ctx.db.token.update({
          where: { id: pendingToken.id },
          data: { usedAt: new Date() },
        }),
      ]);

      audit(ctx.db, {
        userId: ctx.session.user.id,
        agencyId: ctx.session.user.agencyId,
        action: "MFA_ENABLED",
        entityType: "User",
        entityId: ctx.session.user.id,
      });

      return { success: true };
    }),

  /**
   * Disable MFA — requires a valid TOTP code to confirm identity.
   */
  disableMfa: protectedProcedure
    .input(z.object({ code: z.string().length(6, "Código debe tener 6 dígitos") }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { email: true, mfaEnabled: true, totpSecret: true },
      });

      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      if (!user.mfaEnabled || !user.totpSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "MFA no está activado." });
      }

      const isValid = verifyCode(user.totpSecret, user.email, input.code);
      if (!isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Código incorrecto.",
        });
      }

      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { mfaEnabled: false, totpSecret: null },
      });

      audit(ctx.db, {
        userId: ctx.session.user.id,
        agencyId: ctx.session.user.agencyId,
        action: "MFA_DISABLED",
        entityType: "User",
        entityId: ctx.session.user.id,
      });

      return { success: true };
    }),

  /**
   * Verify a TOTP code — used during login when MFA is enabled.
   * Returns true/false instead of throwing so the login UI can handle it gracefully.
   */
  verifyCode: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { email: true, mfaEnabled: true, totpSecret: true },
      });

      if (!user?.mfaEnabled || !user.totpSecret) {
        return { valid: true }; // MFA not required for this user
      }

      const isValid = verifyCode(user.totpSecret, user.email, input.code);
      return { valid: isValid };
    }),
});
