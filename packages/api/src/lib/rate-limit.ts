/**
 * DB-backed Rate Limiter
 *
 * Replaces in-memory Maps that were reset on server restart.
 * Uses the RateLimitRecord table for persistence across instances.
 *
 * Usage:
 *   const allowed = await checkRateLimit(db, "reset:user@email.com", 3, 15 * 60 * 1000);
 *   if (!allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", ... });
 */

import type { PrismaClient } from "@isytask/db";
import { randomUUID } from "crypto";

/**
 * Check and increment a rate limit counter.
 *
 * @param db         Prisma client
 * @param key        Unique key for this rate limit (e.g. "reset:user@email.com")
 * @param maxCount   Maximum number of attempts allowed within the window
 * @param windowMs   Time window in milliseconds
 * @returns          true if allowed, false if rate limit exceeded
 */
export async function checkRateLimit(
  db: PrismaClient,
  key: string,
  maxCount: number,
  windowMs: number
): Promise<boolean> {
  const now = new Date();

  // Find existing record
  const existing = await db.rateLimitRecord.findUnique({ where: { key } });

  if (!existing || existing.expiresAt < now) {
    // Create fresh record (upsert handles race conditions)
    await db.rateLimitRecord.upsert({
      where: { key },
      create: {
        id: randomUUID(),
        key,
        count: 1,
        expiresAt: new Date(Date.now() + windowMs),
      },
      update: {
        count: 1,
        expiresAt: new Date(Date.now() + windowMs),
      },
    });
    return true;
  }

  if (existing.count >= maxCount) {
    return false; // Rate limit exceeded
  }

  // Increment counter
  await db.rateLimitRecord.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  return true;
}

/**
 * Opportunistic cleanup of expired rate limit records.
 * Call this occasionally (e.g., 5% of requests) to keep the table clean.
 */
export async function cleanupExpiredRateLimits(db: PrismaClient): Promise<void> {
  await db.rateLimitRecord
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});
}
