/**
 * GDPR Data Export — GET /api/gdpr/export
 *
 * Returns a downloadable JSON file with all personal data associated
 * with the requesting user's account, per GDPR Article 20 (data portability).
 *
 * Includes:
 *  - User profile
 *  - Tasks created/assigned
 *  - Comments authored
 *  - Notifications
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@isytask/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;

  try {
    // Fetch all data for this user in parallel
    const [user, clientTasks, comments, notifications, taskStatusLogs] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      // Tasks created by user as client
      db.task.findMany({
        where: { client: { userId } },
        select: {
          id: true,
          taskNumber: true,
          title: true,
          description: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.taskComment.findMany({
        where: { authorId: userId },
        select: {
          id: true,
          content: true,
          createdAt: true,
          task: { select: { taskNumber: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.notification.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          createdAt: true,
          isRead: true,
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.taskStatusLog.findMany({
        where: { changedById: userId },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          createdAt: true,
          task: { select: { taskNumber: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user?.id,
        email: user?.email,
        name: user?.name,
        phone: user?.phone,
        role: user?.role,
        createdAt: user?.createdAt,
      },
      tasks: clientTasks,
      comments,
      statusChanges: taskStatusLogs,
      notifications,
    };

    const json = JSON.stringify(exportData, null, 2);

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="isytask-datos-${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GDPR Export] Error:", error);
    return NextResponse.json({ error: "Error interno al exportar datos" }, { status: 500 });
  }
}
