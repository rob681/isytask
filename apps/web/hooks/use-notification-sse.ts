"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";

export function useNotificationSSE() {
  const utils = trpc.useUtils();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function connect() {
      const es = new EventSource("/api/notifications/sse");
      eventSourceRef.current = es;

      es.addEventListener("notification", () => {
        utils.notifications.getUnreadCount.invalidate();
        utils.notifications.list.invalidate();
      });

      es.addEventListener("task_update", () => {
        // Invalidate all task-related queries so every role sees updates in real-time
        utils.tasks.listAll.invalidate();
        utils.tasks.listForKanban.invalidate();
        utils.tasks.getQueue.invalidate();
        utils.tasks.getMyTasks.invalidate();
        utils.tasks.getAssigned.invalidate();
      });

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        // Reconnect after 10 seconds
        reconnectRef.current = setTimeout(connect, 10000);
      };
    }

    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [utils]);
}
