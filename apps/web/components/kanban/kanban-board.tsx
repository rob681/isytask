"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  MeasuringStrategy,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { trpc } from "@/lib/trpc/client";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_BADGE_COLORS,
} from "@isytask/shared";
import { Filter, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type TaskStatus = "RECIBIDA" | "EN_PROGRESO" | "DUDA" | "REVISION" | "FINALIZADA" | "CANCELADA";

// The kanban columns in display order
const KANBAN_COLUMNS: TaskStatus[] = [
  "RECIBIDA",
  "EN_PROGRESO",
  "DUDA",
  "REVISION",
  "FINALIZADA",
];

const COLUMN_COLORS: Record<TaskStatus, string> = {
  RECIBIDA: "border-t-yellow-400",
  EN_PROGRESO: "border-t-blue-400",
  DUDA: "border-t-orange-400",
  REVISION: "border-t-purple-400",
  FINALIZADA: "border-t-green-400",
  CANCELADA: "border-t-red-400",
};

interface KanbanBoardProps {
  showFilters?: boolean;
}

export function KanbanBoard({ showFilters = true }: KanbanBoardProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const utils = trpc.useUtils();

  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [clientFilter, setClientFilter] = useState<string | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);

  const { data: tasks, isLoading } = trpc.tasks.listForKanban.useQuery({
    category: categoryFilter as any,
    clientId: clientFilter,
  });

  const { data: clientsData } = trpc.clients.list.useQuery(
    { page: 1, pageSize: 100 },
    { enabled: role === "ADMIN" && showFilters }
  );

  const updateStatusMutation = trpc.tasks.updateStatusQuick.useMutation({
    // Optimistic update — move card instantly, revert on error
    onMutate: async ({ taskId, newStatus }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await utils.tasks.listForKanban.cancel();

      // Snapshot current data for rollback
      const previous = utils.tasks.listForKanban.getData({
        category: categoryFilter as any,
        clientId: clientFilter,
      });

      // Optimistically update the cache
      utils.tasks.listForKanban.setData(
        { category: categoryFilter as any, clientId: clientFilter },
        (old) =>
          old?.map((t) =>
            t.id === taskId ? { ...t, status: newStatus } : t
          )
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        utils.tasks.listForKanban.setData(
          { category: categoryFilter as any, clientId: clientFilter },
          context.previous
        );
      }
    },
    onSettled: () => {
      // Always refetch to sync with server
      utils.tasks.listForKanban.invalidate();
    },
  });

  // Group tasks by status
  const columns = useMemo(() => {
    if (!tasks) return {};
    const grouped: Record<string, typeof tasks> = {};
    const statuses = showCancelled
      ? [...KANBAN_COLUMNS, "CANCELADA" as TaskStatus]
      : KANBAN_COLUMNS;

    statuses.forEach((status) => {
      grouped[status] = tasks.filter((t) => t.status === status);
    });
    return grouped;
  }, [tasks, showCancelled]);

  const activeTask = useMemo(
    () => tasks?.find((t) => t.id === activeId) ?? null,
    [tasks, activeId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    // Find the task to check if status actually changed
    const task = tasks?.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    updateStatusMutation.mutate({
      taskId,
      newStatus,
    });
  };

  const getTaskHref = (taskId: string) => {
    if (role === "ADMIN") return `/admin/tareas/${taskId}`;
    return `/equipo/tareas/${taskId}`;
  };

  const displayColumns = showCancelled
    ? [...KANBAN_COLUMNS, "CANCELADA" as TaskStatus]
    : KANBAN_COLUMNS;

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={categoryFilter === undefined ? "default" : "outline"}
              onClick={() => setCategoryFilter(undefined)}
            >
              Todas
            </Button>
            {(Object.entries(TASK_CATEGORY_LABELS) as [string, string][]).map(
              ([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={categoryFilter === key ? "default" : "outline"}
                  onClick={() => setCategoryFilter(key)}
                >
                  {label}
                </Button>
              )
            )}
          </div>

          {role === "ADMIN" && clientsData && (
            <>
              <span className="text-muted-foreground">|</span>
              <div className="flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  value={clientFilter ?? ""}
                  onChange={(e) => setClientFilter(e.target.value || undefined)}
                >
                  <option value="">Todos los clientes</option>
                  {clientsData.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName || c.user.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <span className="text-muted-foreground">|</span>
          <Button
            size="sm"
            variant={showCancelled ? "default" : "outline"}
            onClick={() => setShowCancelled(!showCancelled)}
          >
            {showCancelled ? "Ocultar canceladas" : "Mostrar canceladas"}
          </Button>
        </div>
      )}

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Cargando tablero...</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          measuring={{
            draggable: { measure: (element) => element.getBoundingClientRect() },
          }}
        >
          <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
            {displayColumns.map((status) => {
              const columnTasks = columns[status] ?? [];
              return (
                <KanbanColumn
                  key={status}
                  id={status}
                  title={TASK_STATUS_LABELS[status]}
                  count={columnTasks.length}
                  colorClass={COLUMN_COLORS[status]}
                >
                  <SortableContext
                    items={columnTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {columnTasks.map((task) => (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        onClick={() => router.push(getTaskHref(task.id))}
                      />
                    ))}
                  </SortableContext>
                  {columnTasks.length === 0 && (
                    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/60">
                      Sin tareas
                    </div>
                  )}
                </KanbanColumn>
              );
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <KanbanCard task={activeTask} isDragOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {updateStatusMutation.error && (
        <p className="text-sm text-destructive text-center">
          {updateStatusMutation.error.message}
        </p>
      )}
    </div>
  );
}
