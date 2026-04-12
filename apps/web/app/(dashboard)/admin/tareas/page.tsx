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
import { Clock, User, MessageCircle, Filter, PlusCircle, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { KanbanBoard } from "@/components/kanban/kanban-board";

import { SlaIndicator } from "@/components/sla-indicator";
import { TableSkeleton } from "@/components/ui/skeleton";
import { getPrimaryAssigneeName } from "@/lib/task-helpers";

type StatusFilter = "RECIBIDA" | "EN_PROGRESO" | "DUDA" | "REVISION" | "FINALIZADA" | "CANCELADA" | undefined;
type CategoryFilter = "URGENTE" | "NORMAL" | "LARGO_PLAZO" | undefined;
type ViewMode = "list" | "kanban";

export default function AdminTareasPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(undefined);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const { data, isLoading } = trpc.tasks.listAll.useQuery(
    {
      page,
      pageSize: 20,
      status: statusFilter,
      category: categoryFilter,
    },
    { enabled: viewMode === "list" }
  );

  return (
    <>
      <Topbar title="Todas las Tareas" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Header with view toggle and action button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">
              {viewMode === "list" ? "Listado de Tareas" : "Tablero Kanban"}
            </h2>
            <div className="flex items-center rounded-lg border bg-muted p-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Lista
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === "kanban"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Kanban
              </button>
            </div>
          </div>
          <Link href="/admin/nueva-tarea">
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Nueva Tarea
            </Button>
          </Link>
        </div>

        {/* Kanban View */}
        {viewMode === "kanban" && <KanbanBoard showFilters />}

        {/* List View */}
        {viewMode === "list" && (
          <>
            {/* Filters */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={statusFilter === undefined ? "default" : "outline"}
                      onClick={() => { setStatusFilter(undefined); setPage(1); }}
                    >
                      Todos
                    </Button>
                    {(
                      Object.entries(TASK_STATUS_LABELS) as [string, string][]
                    ).map(([key, label]) => (
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
                    ))}
                  </div>
                  <span className="text-muted-foreground">|</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={categoryFilter === undefined ? "default" : "outline"}
                      onClick={() => { setCategoryFilter(undefined); setPage(1); }}
                    >
                      Todas
                    </Button>
                    {(
                      Object.entries(TASK_CATEGORY_LABELS) as [string, string][]
                    ).map(([key, label]) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={categoryFilter === key ? "default" : "outline"}
                        onClick={() => {
                          setCategoryFilter(key as CategoryFilter);
                          setPage(1);
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results count */}
            {data && (
              <p className="text-sm text-muted-foreground">
                {data.total} tarea{data.total !== 1 ? "s" : ""} encontrada
                {data.total !== 1 ? "s" : ""}
              </p>
            )}

            {/* Task list */}
            {isLoading ? (
              <TableSkeleton rows={6} />
            ) : data?.tasks.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <p className="text-muted-foreground">
                  No hay tareas con estos filtros
                </p>
                <p className="text-muted-foreground/60 text-sm max-w-md mx-auto">
                  Los clientes crean nuevas solicitudes desde su portal, o puedes crearlas manualmente con el boton &quot;Nueva Tarea&quot;.
                </p>
              </div>
            ) : (
              data?.tasks.map((task) => (
                <Link key={task.id} href={`/admin/tareas/${task.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer mb-2">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center mt-0.5">
                            {task.taskNumber}
                          </span>
                          <div>
                            <h3 className="font-semibold">
                              {task.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {task.client.user.name} &middot; {task.service.name}
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
                          <User className="h-3 w-3" />
                          {getPrimaryAssigneeName(task)}
                          {task.assignments && task.assignments.length > 1
                            ? ` (+${task.assignments.length - 1})`
                            : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.estimatedHours + task.extraHours} hrs
                        </span>
                        <span className="text-xs">
                          {format(new Date(task.createdAt), "dd MMM yyyy", {
                            locale: es,
                          })}
                        </span>
                        {task.dueAt && (
                          <SlaIndicator
                            dueAt={task.dueAt}
                            completedAt={task.completedAt}
                            status={task.status}
                          />
                        )}
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
          </>
        )}
      </div>
    </>
  );
}
