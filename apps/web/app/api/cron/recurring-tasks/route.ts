import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@isytask/db";

function calculateNextRunAt(
  recurrenceType: "DAILY" | "WEEKLY" | "MONTHLY",
  recurrenceDay: number | null,
  recurrenceTime: string,
  fromDate?: Date
): Date {
  const [hours, minutes] = recurrenceTime.split(":").map(Number);
  const now = fromDate || new Date();
  const next = new Date(now);

  switch (recurrenceType) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY": {
      const targetDay = recurrenceDay ?? 1;
      const currentDay = next.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      next.setDate(next.getDate() + daysUntil);
      break;
    }
    case "MONTHLY": {
      const targetDate = recurrenceDay ?? 1;
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(targetDate, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      break;
    }
  }

  next.setHours(hours, minutes, 0, 0);
  return next;
}

/**
 * API route to execute due recurring tasks.
 * Called by an external cron service or manually by admin.
 */
export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
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
    const now = new Date();
    const dueRecurring = await db.recurringTask.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      include: {
        client: {
          include: { user: { select: { id: true } } },
        },
        service: true,
      },
    });

    const results: Array<{ recurringTaskId: string; taskId: string; title: string }> = [];

    for (const rt of dueRecurring) {
      try {
        // Auto-assign collaborator
        let autoColaboradorId: string | null = null;
        const assignments = await db.colaboradorClientAssignment.findMany({
          where: { clientId: rt.clientId },
          select: { colaboradorId: true },
        });

        if (assignments.length === 1) {
          autoColaboradorId = assignments[0].colaboradorId;
        } else if (assignments.length > 1) {
          const colabIds = assignments.map((a) => a.colaboradorId);
          const taskCounts = await db.task.groupBy({
            by: ["colaboradorId"],
            where: {
              colaboradorId: { in: colabIds },
              status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA", "REVISION"] },
            },
            _count: true,
          });
          const countMap = new Map(taskCounts.map((tc) => [tc.colaboradorId, tc._count]));
          autoColaboradorId = colabIds.sort(
            (a, b) => (countMap.get(a) ?? 0) - (countMap.get(b) ?? 0)
          )[0];
        }

        // Calculate dueAt from SLA
        let dueAt: Date | undefined;
        if (rt.service.slaHours) {
          dueAt = new Date();
          dueAt.setHours(dueAt.getHours() + rt.service.slaHours);
        }

        // Get client's revision limit
        const clientProfile = await db.clientProfile.findUnique({
          where: { id: rt.clientId },
        });

        const task = await db.task.create({
          data: {
            agencyId: rt.agencyId,
            clientId: rt.clientId,
            serviceId: rt.serviceId,
            title: rt.title,
            description: rt.description,
            category: rt.category,
            estimatedHours: rt.service.estimatedHours,
            revisionsLimit: clientProfile?.revisionLimitPerTask ?? 3,
            formData: rt.formData as any,
            ...(dueAt && { dueAt }),
            ...(autoColaboradorId && { colaboradorId: autoColaboradorId }),
            statusLog: {
              create: {
                fromStatus: null,
                toStatus: "RECIBIDA",
                changedById: rt.createdById,
                note: "Tarea creada automáticamente (recurrente)",
              },
            },
          },
          include: {
            service: { select: { name: true } },
            client: { select: { userId: true } },
          },
        });

        // Update recurring task
        const nextRunAt = calculateNextRunAt(
          rt.recurrenceType,
          rt.recurrenceDay,
          rt.recurrenceTime,
          now
        );

        await db.recurringTask.update({
          where: { id: rt.id },
          data: {
            lastRunAt: now,
            nextRunAt,
          },
        });

        // Notify client about new recurring task
        await db.notification.create({
          data: {
            userId: task.client.userId,
            type: "TAREA_RECIBIDA",
            channel: "IN_APP",
            title: "Nueva tarea recibida",
            body: `Tu solicitud recurrente de ${task.service.name} ha sido creada automáticamente.`,
            taskId: task.id,
            sentAt: new Date(),
          },
        }).catch(() => {});

        results.push({
          recurringTaskId: rt.id,
          taskId: task.id,
          title: rt.title,
        });
      } catch (error) {
        console.error(`[Recurring] Failed for ${rt.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      executed: results.length,
      tasks: results,
    });
  } catch (error) {
    console.error("Error executing recurring tasks:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
