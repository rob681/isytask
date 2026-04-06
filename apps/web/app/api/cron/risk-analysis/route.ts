import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@isytask/db";
import { analyzeAgencyRisks } from "@isytask/api";

/**
 * Cron job: Analyze risk for all active agencies.
 * Recommended schedule: daily at 6:30am (after recurring-tasks at 6am).
 *
 * Can be triggered by:
 * - Vercel cron (Authorization: Bearer <CRON_SECRET>)
 * - Authenticated admin session
 */
export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  // Auth: external cron or admin session
  const authHeader = req.headers.get("authorization");
  const cronSecret = req.headers.get("x-cron-secret");
  const isExternalCron =
    (authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`) ||
    (cronSecret && cronSecret === process.env.CRON_SECRET);

  if (!isExternalCron) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Get all active agencies
    const agencies = await db.agency.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    const results = [];

    for (const agency of agencies) {
      try {
        const result = await analyzeAgencyRisks({
          db,
          agencyId: agency.id,
        });
        results.push({
          agencyId: agency.id,
          name: agency.name,
          ...result,
        });
        console.log(
          `[Risk Analysis] ${agency.name}: ${result.analyzed} tasks analyzed, ${result.red} red, ${result.yellow} yellow`
        );
      } catch (error) {
        console.error(
          `[Risk Analysis] Failed for agency ${agency.name}:`,
          error
        );
        results.push({
          agencyId: agency.id,
          name: agency.name,
          error: "Analysis failed",
        });
      }
    }

    return NextResponse.json({
      success: true,
      analyzedAt: new Date().toISOString(),
      agencies: results,
    });
  } catch (error) {
    console.error("[Risk Analysis] Cron error:", error);
    return NextResponse.json(
      { error: "Risk analysis failed" },
      { status: 500 }
    );
  }
}
