"use client";

import { useState, useEffect, useRef } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  Bell,
  CheckCheck,
  MessageSquare,
  ArrowRight,
  PlayCircle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
  Clock,
  Eye,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { PushNotificationToggle } from "@/components/push-notification-toggle";
import { NotificationsSkeleton } from "@/components/ui/skeleton";

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  TAREA_RECIBIDA: <FileText className="h-4 w-4 text-yellow-600" />,
  TAREA_EN_PROGRESO: <PlayCircle className="h-4 w-4 text-blue-600" />,
  TAREA_DUDA: <HelpCircle className="h-4 w-4 text-orange-600" />,
  TAREA_FINALIZADA: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  TAREA_CANCELADA: <XCircle className="h-4 w-4 text-red-600" />,
  NUEVO_COMENTARIO: <MessageSquare className="h-4 w-4 text-purple-600" />,
  CAMBIO_SOLICITADO: <RefreshCw className="h-4 w-4 text-amber-600" />,
  TAREA_EN_REVISION: <Eye className="h-4 w-4 text-purple-600" />,
  TAREA_PENDIENTE_RECORDATORIO: <Clock className="h-4 w-4 text-red-600" />,
  SLA_ALERTA: <AlertTriangle className="h-4 w-4 text-red-600" />,
};

export default function NotificacionesPage() {
  const [page, setPage] = useState(1);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.notifications.list.useQuery({
    page,
    pageSize: 20,
  });

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  const { data: unreadCount } = trpc.notifications.getUnreadCount.useQuery();

  // Auto-mark all as read when page loads with unread notifications
  const hasMarkedRef = useRef(false);
  useEffect(() => {
    if (unreadCount && unreadCount > 0 && !hasMarkedRef.current && !markAllReadMutation.isLoading) {
      hasMarkedRef.current = true;
      markAllReadMutation.mutate();
    }
  }, [unreadCount]);

  return (
    <>
      <Topbar title="Notificaciones" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {unreadCount ? `${unreadCount} sin leer` : "Todas leídas"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PushNotificationToggle />
            {unreadCount && unreadCount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isLoading}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Marcar todas como leídas
              </Button>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <NotificationsSkeleton />
        ) : !data || data.length === 0 ? (
          <Card className="p-8 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No tienes notificaciones</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.map((notif) => (
              <Card
                key={notif.id}
                className={`p-4 transition-colors ${
                  !notif.isRead
                    ? "bg-primary/5 border-primary/20"
                    : "opacity-75"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    {NOTIFICATION_ICONS[notif.type] ?? (
                      <Bell className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{notif.title}</p>
                      {!notif.isRead && (
                        <Badge
                          variant="default"
                          className="h-5 text-[10px] px-1.5"
                        >
                          Nueva
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {notif.body}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notif.createdAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                      {notif.taskId && (
                        <Link
                          href={`/tarea/${notif.taskId}`}
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Ver tarea
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                      {!notif.isRead && (
                        <button
                          onClick={() =>
                            markReadMutation.mutate({ id: notif.id })
                          }
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Marcar como leída
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {data.length >= 20 && (
              <div className="flex justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
