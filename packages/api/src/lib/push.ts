import type { PrismaClient } from "@isytask/db";

interface SendPushParams {
  db: PrismaClient;
  userId: string;
  title: string;
  body: string;
  url?: string;
}

/** Get a config value from the database or return default */
async function getConfig(db: PrismaClient, key: string, defaultValue: any = null) {
  const config = await db.systemConfig.findUnique({ where: { key } });
  return config?.value ?? defaultValue;
}

/**
 * Send push notification to all of a user's subscriptions.
 * Returns number of notifications sent.
 */
export async function sendPushNotification({
  db,
  userId,
  title,
  body,
  url,
}: SendPushParams): Promise<number> {
  try {
    // Check if push notifications are enabled
    const pushEnabled = await getConfig(db, "notification_push_enabled", false);
    if (!pushEnabled) return 0;

    // Get VAPID keys
    const publicKey = await getConfig(db, "vapid_public_key", "");
    const privateKey = await getConfig(db, "vapid_private_key", "");
    const subject = await getConfig(db, "vapid_subject", "mailto:admin@isytask.com");

    if (!publicKey || !privateKey) return 0;

    // Get user's push subscriptions
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) return 0;

    // Dynamic import of web-push
    const webpush = await import("web-push");
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const payload = JSON.stringify({
      title,
      body,
      url: url || "/",
      icon: "/isytask-icon.svg",
      badge: "/isytask-icon.svg",
    });

    let sent = 0;
    const staleSubscriptions: string[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
        sent++;
      } catch (error: any) {
        // 410 Gone or 404 means subscription is expired/invalid
        if (error.statusCode === 410 || error.statusCode === 404) {
          staleSubscriptions.push(sub.id);
        } else {
          console.error("[Push] Error sending push:", error.message);
        }
      }
    }

    // Clean up stale subscriptions
    if (staleSubscriptions.length > 0) {
      await db.pushSubscription.deleteMany({
        where: { id: { in: staleSubscriptions } },
      });
    }

    return sent;
  } catch (error) {
    console.error("[Push] Error:", error);
    return 0;
  }
}
