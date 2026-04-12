import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@isytask/db";

/**
 * API route to check for pending tasks and send reminder notifications.
 * Called when admin loads the dashboard, or can be called by an external cron job.
 *
 * - Finds tasks in RECIBIDA status that have been assigned but not activated
 *   for longer than the configured threshold (default: 24 hours).
 * - Sends a reminder notification to the assigned collaborator.
 * - Only sends one reminder per task (checks if a TAREA_PENDIENTE_RECORDATORIO
 *   notification already exists for that task+user combo).
 */
export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  // Allow either authenticated admin or API key (for external cron)
  // Support both Vercel cron (Authorization: Bearer <secret>) and custom header
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
    // Get configured reminder threshold
    const configRecord = await db.systemConfig.findUnique({
      where: { key: "pending_task_reminder_hours" },
    });
    const reminderHours = (configRecord?.value as number) ?? 24;

    const cutoffDate = new Date(Date.now() - reminderHours * 60 * 60 * 1000);

    // Find tasks that are still in RECIBIDA status, have at least one assignee
    // (legacy primary OR via TaskAssignment), and were created before the cutoff.
    const pendingTasks = await db.task.findMany({
      where: {
        status: "RECIBIDA",
        createdAt: { lt: cutoffDate },
        OR: [
          { colaboradorId: { not: null } },
          { assignments: { some: {} } },
        ],
      },
      include: {
        colaborador: {
          select: { id: true, userId: true },
        },
        assignments: {
          select: {
            colaborador: { select: { id: true, userId: true } },
          },
        },
        service: { select: { name: true } },
        client: { select: { userId: true } },
      },
    });

    let notificationsSent = 0;

    for (const task of pendingTasks) {
      // Build a deduped set of userIds to notify: all TaskAssignment entries
      // PLUS the legacy primary colaborador (if not already covered).
      const userIdsToNotify = new Set<string>();
      for (const a of task.assignments) {
        if (a.colaborador?.userId) userIdsToNotify.add(a.colaborador.userId);
      }
      if (task.colaborador?.userId) {
        userIdsToNotify.add(task.colaborador.userId);
      }
      if (userIdsToNotify.size === 0) continue;

      // Calculate hours since task was created (same for all recipients)
      const hoursSinceCreated = Math.round(
        (Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60)
      );

      for (const userId of userIdsToNotify) {
        // Skip if we already reminded this user about this task
        const existingReminder = await db.notification.findFirst({
          where: {
            userId,
            taskId: task.id,
            type: "TAREA_PENDIENTE_RECORDATORIO",
          },
        });
        if (existingReminder) continue;

        await db.notification.create({
          data: {
            userId,
            type: "TAREA_PENDIENTE_RECORDATORIO",
            channel: "IN_APP",
            title: "Tienes tareas pendientes",
            body: `La tarea #${task.taskNumber} (${task.service.name}) lleva ${hoursSinceCreated} horas sin ser activada. Por favor revísala.`,
            taskId: task.id,
            sentAt: new Date(),
          },
        });

        notificationsSent++;
      }
    }

    return NextResponse.json({
      success: true,
      pendingTasksFound: pendingTasks.length,
      notificationsSent,
    });
  } catch (error) {
    console.error("Error checking pending task reminders:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
