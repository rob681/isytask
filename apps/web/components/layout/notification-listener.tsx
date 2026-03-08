"use client";

import { useNotificationSSE } from "@/hooks/use-notification-sse";

export function NotificationListener() {
  useNotificationSSE();
  return null;
}
