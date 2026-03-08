"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_BADGE_COLORS,
} from "@isytask/shared";
import { Clock, MessageCircle, FileText } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TableSkeleton } from "@/components/ui/skeleton";

type StatusFilter = "RECIBIDA" | "EN_PROGRESO" | "DUDA" | "FINALIZADA" | "CANCELADA" | undefined;

export default function ClienteTareasPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined);
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.tasks.getMyTasks.useQuery({
    page,
    pageSize: 20,
    status: statusFilter,
  });

  return (
    <>
      <Topbar title="Mis Tareas" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Status filters */}
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={statusFilter === undefined ? "default" : "outline"}
            onClick={() => { setStatusFilter(undefined); setPage(1); }}
          >
            Todas
          </Button>
          {(Object.entries(TASK_STATUS_LABELS) as [string, string][]).map(
            ([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={statusFilter === key ? "default" : "outline"}
                onClick={() => {
                  setStatusFilter(key as StatusFilter);
                  setPage(1);
                }}
              >
                {label}
              </Button>
            )
          )}
        </div>

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} tarea{data.total !== 1 ? "s" : ""}
          </p>
        )}

        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : data?.tasks.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-muted-foreground">No tienes tareas</p>
            <Link href="/cliente/nueva-tarea">
              <Button className="mt-4">Crear nueva solicitud</Button>
            </Link>
          </div>
        ) : (
          data?.tasks.map((task) => (
            <Link key={task.id} href={`/cliente/tareas/${task.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer mb-2">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center mt-0.5">
                        {task.taskNumber}
                      </span>
                      <div>
                        <h3 className="font-semibold">{task.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {task.service.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={TASK_CATEGORY_BADGE_COLORS[task.category]}>
                        {TASK_CATEGORY_LABELS[task.category]}
                      </Badge>
                      <Badge
                        className={TASK_STATUS_COLORS[task.status]}
                        variant="outline"
                      >
                        {TASK_STATUS_LABELS[task.status]}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {task.estimatedHours + task.extraHours} hrs
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {task._count.comments}
                    </span>
                    {task.colaborador && (
                      <span>PM: {task.colaborador.user.name}</span>
                    )}
                    <span className="text-xs">
                      {format(new Date(task.createdAt), "dd MMM yyyy", {
                        locale: es,
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {data.pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
