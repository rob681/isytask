import crypto from "crypto";
import type { PrismaClient } from "@isytask/db";

const TOKEN_EXPIRY = {
  INVITATION: 48 * 60 * 60 * 1000,           // 48 hours
  PASSWORD_RESET: 1 * 60 * 60 * 1000,         // 1 hour
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,    // 24 hours
} as const;

type TokenType = "INVITATION" | "PASSWORD_RESET" | "EMAIL_VERIFICATION";

/** Generate a cryptographically secure 64-char hex token */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create and store a token. Invalidates previous unused tokens of the same type for the user.
 */
export async function createToken(
  db: PrismaClient,
  userId: string,
  type: TokenType
): Promise<string> {
  // Invalidate existing unused tokens of same type
  await db.token.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });

  const tokenString = generateSecureToken();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY[type]);

  await db.token.create({
    data: {
      token: tokenString,
      type,
      userId,
      expiresAt,
    },
  });

  // Opportunistic cleanup: ~10% of creations delete old expired tokens
  if (Math.random() < 0.1) {
    await db.token
      .deleteMany({
        where: {
          expiresAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      })
      .catch(() => {});
  }

  return tokenString;
}

/**
 * Validate a token: exists, correct type, not used, not expired.
 * Returns the token record with user info, or null if invalid.
 */
export async function validateToken(
  db: PrismaClient,
  tokenString: string,
  expectedType: TokenType
) {
  const token = await db.token.findUnique({
    where: { token: tokenString },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          passwordHash: true,
        },
      },
    },
  });

  if (!token) return null;
  if (token.type !== expectedType) return null;
  if (token.usedAt !== null) return null;
  if (token.expiresAt < new Date()) return null;

  return token;
}
