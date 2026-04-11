import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@isytask/db";
import { getWorkingConfig, workingHoursUntilDue } from "@isytask/api";

/**
 * API route to check for tasks approaching or exceeding their SLA deadline.
 * Called by an external cron service or manually by admin.
 *
 * - Finds active tasks (RECIBIDA, EN_PROGRESO, DUDA) that have a dueAt date
 * - Threshold comparison uses **working hours** (not calendar time), so
 *   tasks won't trigger false alerts over weekends or outside work hours.
 * - Sends an SLA_ALERTA notification when:
 *   a) The task is overdue (dueAt has passed)
 *   b) Working hours remaining until dueAt <= configured threshold (default 2h)
 * - Only sends one SLA alert per task per day to avoid spam
 */
export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  // Allow either authenticated admin or API key (for external cron)
  const authHeader = req.headers.get("authorization");
  const cronSecret = req.headers.get("x-cron-secret");
  const isExternalCron =
    (authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`) ||
    (cronSecret && cronSecret === process.env.CRON_SECRET);

  if (!isExternalCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  try {
    // Get configured threshold (working hours before deadline to alert)
    const thresholdConfig = await db.systemConfig.findUnique({
      where: { key: "sla_alert_threshold_hours" },
    });
    const thresholdHours = (thresholdConfig?.value as number) ?? 2;

    // Fetch agency working hours config (business_hours + timezone)
    const workingConfig = await getWorkingConfig(db);

    const now = new Date();

    // Wide calendar window to pre-filter candidates from DB.
    // A task with N working hours remaining could be up to ~7 calendar days away
    // (e.g. threshold=2h but coming up after a long weekend). Use 7 days as a safe
    // upper bound — working hours check below will filter correctly.
    const candidateWindowMs = 7 * 24 * 60 * 60 * 1000;
    const candidateUntil = new Date(now.getTime() + candidateWindowMs);

    // Find active tasks with dueAt set within candidate window (or already overdue)
    const candidates = await db.task.findMany({
      where: {
        status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA"] },
        dueAt: {
          not: null,
          lte: candidateUntil,
        },
      },
      include: {
        service: { select: { name: true } },
        client: { select: { userId: true } },
        colaborador: { select: { userId: true } },
      },
    });

    // Filter to only tasks where working hours remaining <= threshold
    const atRiskTasks = candidates.filter((task) => {
      const remaining = workingHoursUntilDue(
        now,
        task.dueAt!,
        workingConfig.businessHours,
        workingConfig.timezone
      );
      return remaining <= thresholdHours;
    });

    let alertsSent = 0;
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const task of atRiskTasks) {
      const recipients: string[] = [];

      if (task.colaborador) {
        recipients.push(task.colaborador.userId);
      }

      const admins = await db.user.findMany({
        where: { role: "ADMIN", isActive: true, agencyId: task.agencyId },
        select: { id: true },
      });
      for (const admin of admins) {
        if (!recipients.includes(admin.id)) {
          recipients.push(admin.id);
        }
      }

      const isOverdue = task.dueAt! <= now;

      // Working hours remaining (for message)
      const workingRemaining = workingHoursUntilDue(
        now,
        task.dueAt!,
        workingConfig.businessHours,
        workingConfig.timezone
      );
      const remainingDisplay =
        workingRemaining < 1
          ? `${Math.round(workingRemaining * 60)} minuto${Math.round(workingRemaining * 60) !== 1 ? "s" : ""}`
          : `${Math.round(workingRemaining)} hora${Math.round(workingRemaining) !== 1 ? "s" : ""}`;

      for (const userId of recipients) {
        const existingAlert = await db.notification.findFirst({
          where: {
            userId,
            taskId: task.id,
            type: "SLA_ALERTA",
            createdAt: { gte: oneDayAgo },
          },
        });

        if (existingAlert) continue;

        const body = isOverdue
          ? `La tarea #${task.taskNumber} (${task.service.name}) ha excedido su plazo de entrega.`
          : `La tarea #${task.taskNumber} (${task.service.name}) vence en ${remainingDisplay} de trabajo.`;

        await db.notification.create({
          data: {
            userId,
            type: "SLA_ALERTA",
            channel: "IN_APP",
            title: isOverdue ? "⚠️ Tarea fuera de SLA" : "⏰ Tarea próxima a vencer",
            body,
            taskId: task.id,
            sentAt: new Date(),
          },
        });

        alertsSent++;
      }
    }

    return NextResponse.json({
      success: true,
      tasksAtRisk: atRiskTasks.length,
      alertsSent,
    });
  } catch (error) {
    console.error("Error checking SLA alerts:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
