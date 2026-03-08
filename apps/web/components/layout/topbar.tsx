"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, ArrowRight, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { GlobalSearch } from "./global-search";

export function Topbar({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: unreadCount } = trpc.notifications.getUnreadCount.useQuery(
    undefined,
    { refetchInterval: 15000 }
  );

  const { data: recentNotifs } = trpc.notifications.list.useQuery(
    { page: 1, pageSize: 5 },
    { enabled: open }
  );

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card/80 backdrop-blur-md px-6 py-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex items-center gap-3">
        <GlobalSearch />
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setOpen(!open)}
          >
            <Bell className="h-5 w-5" />
            {unreadCount && unreadCount > 0 ? (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            ) : null}
          </Button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-card shadow-lg z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <p className="text-sm font-semibold">Notificaciones</p>
                {unreadCount && unreadCount > 0 ? (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Leer todas
                  </button>
                ) : null}
              </div>

              <div className="max-h-72 overflow-y-auto">
                {!recentNotifs || recentNotifs.length === 0 ? (
                  <div className="p-6 text-center">
                    <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Sin notificaciones</p>
                  </div>
                ) : (
                  recentNotifs.map((notif) => (
                    <div
                      key={notif.id}
                      className={`px-4 py-3 border-b last:border-b-0 ${
                        !notif.isRead ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!notif.isRead && (
                          <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{notif.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{notif.body}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notif.createdAt), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Link
                href="/notificaciones"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1 px-4 py-3 text-sm text-primary hover:bg-muted/50 border-t"
              >
                Ver todas
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
