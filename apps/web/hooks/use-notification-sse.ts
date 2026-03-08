"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";

export function useNotificationSSE() {
  const utils = trpc.useUtils();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/notifications/sse");
    eventSourceRef.current = es;

    es.addEventListener("notification", (event) => {
      // Invalidate queries to refresh UI
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.list.invalidate();
    });

    es.onerror = () => {
      // Reconnect after a delay on error
      es.close();
      setTimeout(() => {
        eventSourceRef.current = new EventSource("/api/notifications/sse");
      }, 10000);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [utils]);
}
