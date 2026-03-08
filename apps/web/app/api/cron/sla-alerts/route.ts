import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@isytask/db";

/**
 * API route to check for tasks approaching or exceeding their SLA deadline.
 * Called by an external cron service or manually by admin.
 *
 * - Finds active tasks (RECIBIDA, EN_PROGRESO, DUDA) that have a dueAt date
 * - Sends an SLA_ALERTA notification when:
 *   a) The task is overdue (dueAt has passed)
 *   b) The task is approaching deadline (within configured threshold, default 2 hours)
 * - Only sends one SLA alert per task per day to avoid spam
 */
export async function POST(req: NextRequest) {
  // Allow either authenticated admin or API key (for external cron)
  const cronSecret = req.headers.get("x-cron-secret");
  const isExternalCron = cronSecret && cronSecret === process.env.CRON_SECRET;

  if (!isExternalCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  try {
    // Get configured threshold (hours before deadline to alert)
    const thresholdConfig = await db.systemConfig.findUnique({
      where: { key: "sla_alert_threshold_hours" },
    });
    const thresholdHours = (thresholdConfig?.value as number) ?? 2;

    const now = new Date();
    const thresholdDate = new Date(now.getTime() + thresholdHours * 60 * 60 * 1000);

    // Find active tasks approaching or past their SLA deadline
    const atRiskTasks = await db.task.findMany({
      where: {
        status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA"] },
        dueAt: {
          not: null,
          lte: thresholdDate, // Due within threshold or already overdue
        },
      },
      include: {
        service: { select: { name: true } },
        client: { select: { userId: true } },
        colaborador: {
          select: {
            userId: true,
          },
        },
      },
    });

    let alertsSent = 0;

    // Check for recent SLA alerts (avoid duplicate alerts within 24h)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const task of atRiskTasks) {
      // Determine recipients: assigned collaborator + all admins
      const recipients: string[] = [];

      // Add assigned collaborator
      if (task.colaborador) {
        recipients.push(task.colaborador.userId);
      }

      // Add admins
      const admins = await db.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });
      for (const admin of admins) {
        if (!recipients.includes(admin.id)) {
          recipients.push(admin.id);
        }
      }

      const isOverdue = task.dueAt! <= now;
      const hoursUntilDue = Math.round(
        (task.dueAt!.getTime() - now.getTime()) / (1000 * 60 * 60)
      );

      for (const userId of recipients) {
        // Check if we already sent an SLA alert for this task+user within 24h
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
          : `La tarea #${task.taskNumber} (${task.service.name}) vence en ${Math.abs(hoursUntilDue)} hora${Math.abs(hoursUntilDue) !== 1 ? "s" : ""}.`;

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
