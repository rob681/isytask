import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@isytask/db";
import { runQATesting } from "@isytask/api";

/**
 * QA Testing Cron Job
 * Tests all Isytask functionalities and generates a comprehensive report
 *
 * Can be triggered by:
 * - Vercel cron (Authorization: Bearer <CRON_SECRET>)
 * - Authenticated admin session
 * - Direct API call with cron secret
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
    console.log("[QA Testing] Starting comprehensive test suite...");
    const startTime = Date.now();

    // Run QA tests
    const report = await runQATesting(db);

    const duration = Date.now() - startTime;

    console.log(
      `[QA Testing] Completed in ${duration}ms - ${report.passed} passed, ${report.failed} failed, ${report.warnings} warnings`
    );

    // Log results to console for monitoring
    console.log("\n=== QA TESTING REPORT ===\n");
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Duration: ${report.duration}ms`);
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`✓ Passed: ${report.passed}`);
    console.log(`✗ Failed: ${report.failed}`);
    console.log(`⚠ Warnings: ${report.warnings}`);

    console.log("\n--- WORKING FEATURES ---");
    report.summary.workingFeatures.forEach((f) => console.log(`✓ ${f}`));

    if (report.summary.brokenFeatures.length > 0) {
      console.log("\n--- BROKEN FEATURES ---");
      report.summary.brokenFeatures.forEach((f) => console.log(`✗ ${f}`));
    }

    console.log("\n--- SUGGESTIONS ---");
    report.summary.improvementSuggestions.forEach((s) => console.log(s));

    console.log("\n--- DETAILED RESULTS ---");
    report.results.forEach((r) => {
      const icon = r.status === "PASS" ? "✓" : r.status === "FAIL" ? "✗" : "⚠";
      console.log(
        `${icon} ${r.name} (${r.duration}ms)${r.error ? ` - ${r.error}` : ""}`
      );
    });

    return NextResponse.json(
      {
        success: true,
        timestamp: report.timestamp,
        duration: report.duration,
        summary: {
          total: report.totalTests,
          passed: report.passed,
          failed: report.failed,
          warnings: report.warnings,
        },
        report,
      },
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[QA Testing] Critical error:", error);
    return NextResponse.json(
      {
        error: "QA testing failed",
        message: String(error),
      },
      { status: 500 }
    );
  }
}
