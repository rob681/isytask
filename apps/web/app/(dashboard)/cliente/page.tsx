"use client";

import { useEffect, useRef, useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_BADGE_COLORS,
} from "@isytask/shared";
import { Clock, User, MessageCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { CardListSkeleton } from "@/components/ui/skeleton";

const DAY_LABELS: Record<string, string> = {
  monday: "Lun",
  tuesday: "Mar",
  wednesday: "Mié",
  thursday: "Jue",
  friday: "Vie",
  saturday: "Sáb",
  sunday: "Dom",
};
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// Segmented progress bar (10 blocks)
function SegmentedProgress({
  progress,
  isOwn,
}: {
  progress: number;
  isOwn: boolean;
}) {
  const totalSegments = 10;
  const filledSegments = Math.round((progress / 100) * totalSegments);

  return (
    <div className="flex gap-1">
      {Array.from({ length: totalSegments }).map((_, i) => (
        <div
          key={i}
          className={`h-2.5 flex-1 rounded-sm transition-colors ${
            i < filledSegments
              ? isOwn
                ? "bg-primary"
                : "bg-muted-foreground/30"
              : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

function getGenericStatus(status: string): string {
  if (status === "EN_PROGRESO" || status === "DUDA") return "Tarea en proceso";
  return "Tarea pendiente";
}

function getGenericTime(estimatedHours: number): string {
  if (estimatedHours <= 0) return "Tiempo por confirmar";
  if (estimatedHours < 1)
    return `${Math.round(estimatedHours * 60)} min estimados`;
  return `${estimatedHours} Hrs. estimadas`;
}

export default function ClienteColaPage() {
  const { data: queue, isLoading } = trpc.tasks.getQueue.useQuery({
    pageSize: 50,
  });
  const { data: publicConfig } = trpc.config.getPublic.useQuery();
  const businessHours = publicConfig?.business_hours as Record<string, { enabled: boolean; blocks: { start: string; end: string }[] }> | undefined;

  // Find first own task for summary card
  const firstOwnTask = queue?.find((t) => t.isOwn);
  const ownTaskRef = useRef<HTMLDivElement | null>(null);
  const [showSummary, setShowSummary] = useState(true);

  // IntersectionObserver: hide summary when own task is visible
  useEffect(() => {
    if (!firstOwnTask || !ownTaskRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowSummary(!entry.isIntersecting);
      },
      { threshold: 0.5 }
    );

    observer.observe(ownTaskRef.current);
    return () => observer.disconnect();
  }, [firstOwnTask, queue]);

  return (
    <>
      <Topbar title="Cola de Tareas" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Business hours card */}
        {businessHours && (
          <Card className="border-muted">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Horario de atención</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {DAY_KEYS.map((day) => {
                  const conf = businessHours[day];
                  if (!conf?.enabled) return (
                    <div key={day} className="text-xs text-muted-foreground">
                      <span className="font-medium">{DAY_LABELS[day]}</span>
                      <span className="ml-1 italic">Cerrado</span>
                    </div>
                  );
                  return (
                    <div key={day} className="text-xs">
                      <span className="font-medium text-foreground">{DAY_LABELS[day]}</span>
                      <span className="ml-1 text-muted-foreground">
                        {conf.blocks.map((b, i) => (
                          <span key={i}>
                            {i > 0 && ", "}
                            {b.start}–{b.end}
                          </span>
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <CardListSkeleton cards={3} />
        ) : queue?.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-muted-foreground">
              No hay tareas activas en la cola
            </p>
            <Link
              href="/cliente/nueva-tarea"
              className="text-primary hover:underline text-sm mt-2 inline-block"
            >
              Crear nueva solicitud
            </Link>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline */}
            <div className="space-y-0">
              {queue?.map((task, idx) => {
                const isLast = idx === queue.length - 1;
                const progress =
                  task.estimatedHours > 0
                    ? Math.min(
                        (task.elapsedHours / task.estimatedHours) * 100,
                        100
                      )
                    : 0;

                const isFirstOwn = firstOwnTask?.id === task.id;

                return (
                  <div
                    key={task.id}
                    ref={isFirstOwn ? ownTaskRef : undefined}
                    className="flex gap-4"
                  >
                    {/* Timeline column */}
                    <div className="flex flex-col items-center flex-shrink-0 w-8">
                      {/* Numbered circle */}
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold border flex-shrink-0 ${
                          task.isOwn
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-muted-foreground/30"
                        }`}
                      >
                        {task.queuePosition}
                      </div>
                      {/* Connector line */}
                      {!isLast && (
                        <div className="w-0.5 flex-1 min-h-[16px] bg-border" />
                      )}
                    </div>

                    {/* Card */}
                    <div className="flex-1 pb-4">
                      {task.isOwn ? (
                        /* === OWN TASK CARD === */
                        <Link href={`/cliente/tareas/${task.id}`}>
                          <Card className="border-primary/40 hover:border-primary transition-colors cursor-pointer">
                            <CardContent className="p-4">
                              {/* Header row */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  {/* Avatar */}
                                  {task.clientAvatar ? (
                                    <img
                                      src={task.clientAvatar}
                                      alt=""
                                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                                      {task.clientName
                                        ? task.clientName.charAt(0).toUpperCase()
                                        : "?"}
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-semibold text-sm">
                                      {task.clientName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {task.serviceType}
                                      {task.taskNumber && (
                                        <span className="ml-1 font-mono">
                                          #{task.taskNumber}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <Badge
                                    className={
                                      TASK_CATEGORY_BADGE_COLORS[task.category]
                                    }
                                  >
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

                              {/* Title */}
                              {task.title && (
                                <p className="text-sm font-medium mb-3 text-foreground">
                                  {task.title}
                                </p>
                              )}

                              {/* Hours */}
                              <div className="flex items-center justify-between text-sm mb-2">
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {task.elapsedHours} de{" "}
                                  {task.estimatedHours} Hrs.
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {Math.round(progress)}%
                                </span>
                              </div>

                              {/* Segmented progress */}
                              <SegmentedProgress
                                progress={progress}
                                isOwn={true}
                              />

                              {/* Footer row */}
                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  PM:{" "}
                                  {task.colaboradorName ?? "Sin asignar"}
                                </span>
                                <div className="flex items-center gap-2">
                                  {task.hasUnreadComments && (
                                    <Badge
                                      variant="destructive"
                                      className="text-xs"
                                    >
                                      <MessageCircle className="h-3 w-3 mr-1" />
                                      Pregunta
                                    </Badge>
                                  )}
                                  <span className="text-xs text-primary hover:underline">
                                    Ver detalle
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ) : (
                        /* === OTHER TASK CARD (faded) === */
                        <Card className="opacity-60">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {/* Generic avatar */}
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                  <User className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground italic">
                                    {getGenericStatus(task.status)}
                                  </p>
                                </div>
                              </div>
                              <Badge
                                className={TASK_STATUS_COLORS[task.status]}
                                variant="outline"
                              >
                                {TASK_STATUS_LABELS[task.status]}
                              </Badge>
                            </div>

                            {/* Hours (generic) */}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                              <Clock className="h-3 w-3" />
                              {getGenericTime(task.estimatedHours)}
                            </div>

                            {/* Faded progress */}
                            <SegmentedProgress
                              progress={
                                task.estimatedHours > 0
                                  ? Math.min(
                                      (task.elapsedHours /
                                        task.estimatedHours) *
                                        100,
                                      100
                                    )
                                  : 0
                              }
                              isOwn={false}
                            />
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary card at bottom */}
            {firstOwnTask && showSummary && (
              <div className="sticky bottom-0 pt-2 pb-2">
                {/* Gradient fade */}
                <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none -translate-y-full" />

                <Link href={`/cliente/tareas/${firstOwnTask.id}`}>
                  <Card className="border-primary shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {firstOwnTask.clientAvatar ? (
                            <img
                              src={firstOwnTask.clientAvatar}
                              alt=""
                              className="w-9 h-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                              {firstOwnTask.clientName
                                ? firstOwnTask.clientName
                                    .charAt(0)
                                    .toUpperCase()
                                : "?"}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-sm">
                              Tu tarea &middot; Posici&oacute;n #
                              {firstOwnTask.queuePosition}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {firstOwnTask.serviceType}
                              {firstOwnTask.taskNumber && (
                                <span className="ml-1 font-mono">
                                  #{firstOwnTask.taskNumber}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <Badge
                          className={
                            TASK_CATEGORY_BADGE_COLORS[firstOwnTask.category]
                          }
                        >
                          {TASK_CATEGORY_LABELS[firstOwnTask.category]}
                        </Badge>
                      </div>

                      {/* Progress */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {firstOwnTask.elapsedHours} de{" "}
                          {firstOwnTask.estimatedHours} Hrs.
                        </span>
                        <span>
                          {Math.round(
                            firstOwnTask.estimatedHours > 0
                              ? Math.min(
                                  (firstOwnTask.elapsedHours /
                                    firstOwnTask.estimatedHours) *
                                    100,
                                  100
                                )
                              : 0
                          )}
                          %
                        </span>
                      </div>
                      <SegmentedProgress
                        progress={
                          firstOwnTask.estimatedHours > 0
                            ? Math.min(
                                (firstOwnTask.elapsedHours /
                                  firstOwnTask.estimatedHours) *
                                  100,
                                100
                              )
                            : 0
                        }
                        isOwn={true}
                      />

                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          PM: {firstOwnTask.colaboradorName ?? "Sin asignar"}
                        </span>
                        <span className="text-xs text-primary">
                          Haz scroll para ver tu posici&oacute;n
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
