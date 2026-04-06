import type { PrismaClient } from "@isytask/db";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
}

/**
 * Send push notification to a user's mobile devices via Expo Push API.
 *
 * This sends to ALL active Expo Push Tokens for the given user.
 * Expo's server handles delivery to APNs (iOS) and FCM (Android).
 */
export async function sendExpoPushToUser(
  db: PrismaClient,
  userId: string,
  notification: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  // Get all active tokens for this user
  const tokens = await db.expoPushToken.findMany({
    where: { userId, isActive: true },
    select: { token: true },
  });

  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    sound: "default",
    channelId: "default",
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    // Mark invalid tokens as inactive
    if (result.data) {
      for (let i = 0; i < result.data.length; i++) {
        const ticket = result.data[i];
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          await db.expoPushToken.updateMany({
            where: { token: tokens[i].token },
            data: { isActive: false },
          });
        }
      }
    }
  } catch (error) {
    console.error("[ExpoPush] Failed to send:", error);
  }
}

/**
 * Send push notification to multiple users.
 */
export async function sendExpoPushToUsers(
  db: PrismaClient,
  userIds: string[],
  notification: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  await Promise.all(
    userIds.map((userId) => sendExpoPushToUser(db, userId, notification))
  );
}
