import type { PrismaClient } from "@isytask/db";
import type { NotificationType, TaskStatus } from "@isytask/shared";
import { NOTIFICATION_TEMPLATES } from "@isytask/shared";
import { sendEmailNotification } from "./email";
import { sendPushNotification } from "./push";
import { sendWhatsAppMessage } from "./whatsapp";

interface NotifyParams {
  db: PrismaClient;
  userId: string;
  type: NotificationType;
  taskId: string;
  data: Record<string, string>;
}

/** Map task status to notification type */
export function statusToNotificationType(
  status: TaskStatus
): NotificationType | null {
  const map: Partial<Record<TaskStatus, NotificationType>> = {
    RECIBIDA: "TAREA_RECIBIDA",
    EN_PROGRESO: "TAREA_EN_PROGRESO",
    DUDA: "TAREA_DUDA",
    REVISION: "TAREA_EN_REVISION",
    FINALIZADA: "TAREA_FINALIZADA",
    CANCELADA: "TAREA_CANCELADA",
  };
  return map[status] ?? null;
}

/**
 * Create in-app notification + send email + send push.
 */
export async function sendNotification({ db, userId, type, taskId, data }: NotifyParams) {
  const template = NOTIFICATION_TEMPLATES[type];
  if (!template) return;

  const title = template.title;
  const body = template.body(data);

  // ─── 1. In-app notification ───────────────────────────
  const inappConfig = await db.systemConfig.findUnique({
    where: { key: "notification_inapp_enabled" },
  });
  const inappEnabled = inappConfig?.value !== false;

  if (inappEnabled) {
    await db.notification.create({
      data: {
        userId,
        type,
        channel: "IN_APP",
        title,
        body,
        taskId,
        sentAt: new Date(),
      },
    });
  }

  // ─── 2. Email notification ────────────────────────────
  // Fire and forget — don't block the main flow
  (async () => {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!user?.email) return;

      // Build a URL to the task (best effort)
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const taskUrl = taskId ? `${baseUrl}/notificaciones` : baseUrl;

      await sendEmailNotification({
        db,
        to: user.email,
        subject: `${title} — Isytask`,
        title,
        body,
        taskId,
        actionUrl: taskUrl,
        actionLabel: "Ver en Isytask",
      });

      // Also log the email notification in DB
      await db.notification.create({
        data: {
          userId,
          type,
          channel: "EMAIL",
          title,
          body,
          taskId,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      console.error("[Notification] Email send failed:", error);
    }
  })();

  // ─── 3. Push notification ─────────────────────────────
  // Fire and forget
  sendPushNotification({
    db,
    userId,
    title,
    body,
    url: taskId ? `/notificaciones` : "/",
  }).catch((error) => {
    console.error("[Notification] Push send failed:", error);
  });

  // ─── 4. WhatsApp notification ───────────────────────
  // Fire and forget
  (async () => {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      });
      if (!user?.phone) return;

      const sent = await sendWhatsAppMessage({
        db,
        to: user.phone,
        body: `*${title}*\n${body}`,
      });

      if (sent) {
        await db.notification.create({
          data: {
            userId,
            type,
            channel: "WHATSAPP",
            title,
            body,
            taskId,
            sentAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error("[Notification] WhatsApp send failed:", error);
    }
  })();
}

/**
 * Notify the client about a task status change.
 */
export async function notifyTaskStatusChange({
  db,
  task,
  newStatus,
}: {
  db: PrismaClient;
  task: {
    id: string;
    taskNumber: number;
    clientId: string;
    colaboradorId: string | null;
    client: { userId: string };
    service: { name: string };
  };
  newStatus: TaskStatus;
}) {
  const notifType = statusToNotificationType(newStatus);
  if (!notifType) return;

  const data = {
    taskNumber: String(task.taskNumber),
    serviceType: task.service.name,
  };

  // Notify the client
  await sendNotification({
    db,
    userId: task.client.userId,
    type: notifType,
    taskId: task.id,
    data,
  });

  // If collaborator assigned, notify them too (except for CANCELADA which the client triggers)
  if (task.colaboradorId && newStatus !== "CANCELADA") {
    const colab = await db.colaboradorProfile.findUnique({
      where: { id: task.colaboradorId },
      select: { userId: true },
    });
    if (colab && colab.userId !== task.client.userId) {
      await sendNotification({
        db,
        userId: colab.userId,
        type: notifType,
        taskId: task.id,
        data,
      });
    }
  }
}

/**
 * Notify about a new comment on a task.
 */
export async function notifyNewComment({
  db,
  task,
  commentAuthorId,
}: {
  db: PrismaClient;
  task: {
    id: string;
    taskNumber: number;
    clientId: string;
    colaboradorId: string | null;
    client: { userId: string };
    service: { name: string };
  };
  commentAuthorId: string;
}) {
  const data = {
    taskNumber: String(task.taskNumber),
    serviceType: task.service.name,
  };

  // Notify participants who are NOT the comment author
  const recipients: string[] = [];

  // Client
  if (task.client.userId !== commentAuthorId) {
    recipients.push(task.client.userId);
  }

  // Collaborator
  if (task.colaboradorId) {
    const colab = await db.colaboradorProfile.findUnique({
      where: { id: task.colaboradorId },
      select: { userId: true },
    });
    if (colab && colab.userId !== commentAuthorId && !recipients.includes(colab.userId)) {
      recipients.push(colab.userId);
    }
  }

  for (const userId of recipients) {
    await sendNotification({
      db,
      userId,
      type: "NUEVO_COMENTARIO",
      taskId: task.id,
      data,
    });
  }
}
