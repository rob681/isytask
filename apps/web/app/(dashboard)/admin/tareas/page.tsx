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
import { Clock, User, MessageCircle, Filter, PlusCircle, LayoutGrid, List, Check, X, Trash2, MousePointer, ChevronLeft, ChevronRight } from "lucide-react";
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
type TaskStatus = "RECIBIDA" | "EN_PROGRESO" | "DUDA" | "REVISION" | "FINALIZADA" | "CANCELADA";

export default function AdminTareasPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(undefined);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.tasks.listAll.useQuery(
    {
      page,
      pageSize: 20,
      status: statusFilter,
      category: categoryFilter,
      month: filterMonth,
      year: filterYear,
    },
    { enabled: viewMode === "list" }
  );

  const bulkUpdateStatus = trpc.tasks.bulkUpdateStatus.useMutation({
    onSuccess: () => {
      utils.tasks.listAll.invalidate();
      setSelectedIds(new Set());
    },
  });

  const bulkDelete = trpc.tasks.bulkDelete.useMutation({
    onSuccess: () => {
      utils.tasks.listAll.invalidate();
      setSelectedIds(new Set());
    },
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }

  function handleBulkStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const status = e.target.value as TaskStatus;
    if (!status) return;
    bulkUpdateStatus.mutate({ ids: Array.from(selectedIds), status });
    e.target.value = "";
  }

  function handleBulkDelete() {
    const count = selectedIds.size;
    if (
      window.confirm(
        `¿Eliminar ${count} tarea${count !== 1 ? "s" : ""}? Esta acción no se puede deshacer.`
      )
    ) {
      bulkDelete.mutate({ ids: Array.from(selectedIds) });
    }
  }

  const handlePrevMonth = () => {
    if (filterMonth === 1) {
      setFilterMonth(12);
      setFilterYear(filterYear - 1);
    } else {
      setFilterMonth(filterMonth - 1);
    }
    setPage(1);
  };

  const handleNextMonth = () => {
    const now = new Date();
    const isCurrentMonth = filterMonth === now.getMonth() + 1 && filterYear === now.getFullYear();
    if (!isCurrentMonth) {
      if (filterMonth === 12) {
        setFilterMonth(1);
        setFilterYear(filterYear + 1);
      } else {
        setFilterMonth(filterMonth + 1);
      }
      setPage(1);
    }
  };

  const now = new Date();
  const isCurrentMonth = filterMonth === now.getMonth() + 1 && filterYear === now.getFullYear();
  const monthName = format(new Date(filterYear, filterMonth - 1, 1), "MMMM yyyy", { locale: es });

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
          <div className="flex items-center gap-2">
            {viewMode === "list" && !selectionMode && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setSelectionMode(true)}
              >
                <MousePointer className="h-4 w-4" />
                Seleccionar
              </Button>
            )}
            {viewMode === "list" && selectionMode && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={clearSelection}
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
            )}
            <Link href="/admin/nueva-tarea">
              <Button className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Nueva Tarea
              </Button>
            </Link>
          </div>
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

                  {/* Month Navigator */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handlePrevMonth}
                      className="p-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[140px] text-center capitalize">
                      {monthName}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleNextMonth}
                      disabled={isCurrentMonth}
                      className="p-1"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <span className="text-muted-foreground">|</span>

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
              data?.tasks.map((task) => {
                const isSelected = selectedIds.has(task.id);
                const isOverdue = task.dueAt && new Date(task.dueAt) < new Date() && task.status !== "FINALIZADA" && task.status !== "CANCELADA";
                return (
                  <Link key={task.id} href={`/admin/tareas/${task.id}`} className="relative group block">
                    {/* Checkbox overlay */}
                    {(selectionMode || selectedIds.size > 0) && (
                      <div
                        className={`absolute top-3 left-3 z-20 w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary border-primary"
                            : "bg-background border-border opacity-0 group-hover:opacity-100"
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleSelect(task.id);
                        }}
                      >
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                      </div>
                    )}
                    <Card className={`hover:border-primary/50 transition-colors cursor-pointer mb-2 ${isSelected ? "border-primary/60 bg-primary/5" : ""} ${isOverdue ? "border-2 border-red-500 bg-red-50 dark:bg-red-950/20" : ""}`}>
                      <CardContent className={`p-4 ${(selectionMode || selectedIds.size > 0) ? "pl-10" : ""}`}>
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
                            {isOverdue && (
                              <Badge className="bg-red-500 text-white hover:bg-red-600">
                                VENCIDA
                              </Badge>
                            )}
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
                );
              })
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

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-xl rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} seleccionada{selectedIds.size !== 1 ? "s" : ""}
          </span>
          <select
            className="text-sm border rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            defaultValue=""
            onChange={handleBulkStatusChange}
            disabled={bulkUpdateStatus.isPending}
          >
            <option value="" disabled>Cambiar estado...</option>
            {(Object.entries(TASK_STATUS_LABELS) as [string, string][]).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkDelete.isPending}
            className="flex items-center gap-1.5 text-sm font-medium text-destructive hover:text-destructive/80 border border-destructive/40 hover:border-destructive/70 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
