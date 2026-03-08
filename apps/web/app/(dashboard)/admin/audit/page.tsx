"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@isytask/shared";
import {
  Activity,
  ArrowRightLeft,
  MessageCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Filter,
  X,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TableSkeleton } from "@/components/ui/skeleton";

type EntityFilter = "ALL" | "STATUS_CHANGE" | "COMMENT" | "TASK_CREATED";

const ENTITY_LABELS: Record<EntityFilter, string> = {
  ALL: "Todos",
  STATUS_CHANGE: "Cambios de estado",
  COMMENT: "Comentarios",
  TASK_CREATED: "Tareas creadas",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  STATUS_CHANGE: <ArrowRightLeft className="h-4 w-4 text-blue-500" />,
  COMMENT: <MessageCircle className="h-4 w-4 text-green-500" />,
  TASK_CREATED: <Plus className="h-4 w-4 text-purple-500" />,
};

const TYPE_COLORS: Record<string, string> = {
  STATUS_CHANGE: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  COMMENT: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  TASK_CREATED: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<EntityFilter>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const { data: users } = trpc.audit.getUsers.useQuery();
  const { data: auditData, isLoading } = trpc.audit.getLog.useQuery({
    page,
    pageSize: 30,
    entityType,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    userId: selectedUserId || undefined,
  });

  const hasFilters = entityType !== "ALL" || dateFrom || dateTo || selectedUserId;

  const clearFilters = () => {
    setEntityType("ALL");
    setDateFrom("");
    setDateTo("");
    setSelectedUserId("");
    setPage(1);
  };

  return (
    <>
      <Topbar title="Historial de Actividad" />
      <div className="p-4 md:p-6 space-y-6">
        <p className="text-muted-foreground">
          Registro cronológico de todas las acciones realizadas en el sistema
        </p>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />

              {/* Type filter */}
              <div className="flex gap-1">
                {(Object.entries(ENTITY_LABELS) as [EntityFilter, string][]).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={entityType === key ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => { setEntityType(key); setPage(1); }}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <div className="h-6 w-px bg-border" />

              {/* Date filters */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                />
                <span className="text-xs text-muted-foreground">a</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                />
              </div>

              <div className="h-6 w-px bg-border" />

              {/* User filter */}
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <select
                  className="h-7 rounded-md border border-input bg-background px-2 text-xs min-w-[140px]"
                  value={selectedUserId}
                  onChange={(e) => { setSelectedUserId(e.target.value); setPage(1); }}
                >
                  <option value="">Todos los usuarios</option>
                  {users?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={clearFilters}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary badge */}
        {auditData && (
          <div className="flex items-center gap-3">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {auditData.total} registros encontrados
            </span>
          </div>
        )}

        {/* Audit log entries */}
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : (
          <div className="space-y-2">
            {auditData?.items.map((entry) => (
              <Card key={entry.id} className="hover:border-muted-foreground/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Type icon */}
                    <div className="flex-shrink-0 mt-0.5 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      {TYPE_ICONS[entry.type]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{entry.userName}</span>
                        <Badge className={`text-[10px] ${TYPE_COLORS[entry.type]}`}>
                          {entry.type === "STATUS_CHANGE"
                            ? "Cambio de estado"
                            : entry.type === "COMMENT"
                              ? "Comentario"
                              : "Tarea creada"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(entry.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                        </span>
                      </div>

                      <div className="mt-1">
                        {entry.type === "STATUS_CHANGE" && entry.meta?.fromStatus && entry.meta?.toStatus ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${TASK_STATUS_COLORS[entry.meta.fromStatus as keyof typeof TASK_STATUS_COLORS] ?? ""}`}
                            >
                              {TASK_STATUS_LABELS[entry.meta.fromStatus as keyof typeof TASK_STATUS_LABELS] ?? entry.meta.fromStatus}
                            </Badge>
                            <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${TASK_STATUS_COLORS[entry.meta.toStatus as keyof typeof TASK_STATUS_COLORS] ?? ""}`}
                            >
                              {TASK_STATUS_LABELS[entry.meta.toStatus as keyof typeof TASK_STATUS_LABELS] ?? entry.meta.toStatus}
                            </Badge>
                            {entry.meta.note && (
                              <span className="text-xs text-muted-foreground ml-2">
                                — {entry.meta.note}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{entry.detail}</p>
                        )}
                      </div>

                      {/* Task reference */}
                      <Link
                        href={`/admin/tareas/${entry.taskId}`}
                        className="inline-flex items-center gap-1 mt-1.5 text-xs text-primary hover:underline"
                      >
                        <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[9px] font-semibold flex items-center justify-center">
                          {entry.taskNumber}
                        </span>
                        {entry.taskTitle}
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {auditData?.items.length === 0 && (
              <p className="text-muted-foreground text-center py-12">
                No se encontraron registros con los filtros seleccionados
              </p>
            )}
          </div>
        )}

        {/* Pagination */}
        {auditData && auditData.totalPages > 1 && (
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {auditData.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= auditData.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
