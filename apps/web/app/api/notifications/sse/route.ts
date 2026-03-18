import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@isytask/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = (session.user as any).id;
  const agencyId = (session.user as any).agencyId as string | null;

  const encoder = new TextEncoder();
  let closed = false;
  let lastCheck = new Date();
  let lastTaskCheck = new Date();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode("event: connected\ndata: ok\n\n"));

      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          const now = new Date();

          // Check for new notifications since last check
          const newNotifs = await db.notification.findMany({
            where: {
              userId,
              channel: "IN_APP",
              createdAt: { gt: lastCheck },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          });

          lastCheck = now;

          if (newNotifs.length > 0) {
            const unreadCount = await db.notification.count({
              where: { userId, channel: "IN_APP", isRead: false },
            });

            const payload = JSON.stringify({
              type: "new_notifications",
              count: unreadCount,
              notifications: newNotifs.map((n) => ({
                id: n.id,
                title: n.title,
                body: n.body,
                type: n.type,
                taskId: n.taskId,
              })),
            });

            controller.enqueue(
              encoder.encode(`event: notification\ndata: ${payload}\n\n`)
            );
          }

          // Check for task changes in the agency (created, updated, commented)
          if (agencyId) {
            const [updatedTasks, newComments] = await Promise.all([
              db.task.findMany({
                where: {
                  agencyId,
                  updatedAt: { gt: lastTaskCheck },
                },
                select: {
                  id: true,
                  title: true,
                  status: true,
                  updatedAt: true,
                },
                take: 10,
                orderBy: { updatedAt: "desc" },
              }),
              db.taskComment.count({
                where: {
                  task: { agencyId },
                  createdAt: { gt: lastTaskCheck },
                },
              }),
            ]);

            lastTaskCheck = now;

            if (updatedTasks.length > 0 || newComments > 0) {
              const payload = JSON.stringify({
                type: "task_updates",
                tasks: updatedTasks.map((t) => ({
                  id: t.id,
                  title: t.title,
                  status: t.status,
                })),
                newComments,
              });

              controller.enqueue(
                encoder.encode(`event: task_update\ndata: ${payload}\n\n`)
              );
            }
          }

          // Heartbeat to keep connection alive
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // DB error - just skip this interval
        }
      }, 5000); // Check every 5 seconds

      // Cleanup
      return () => {
        closed = true;
        clearInterval(interval);
      };
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
