"use client";

import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SlaIndicatorProps {
  dueAt: Date | string | null | undefined;
  completedAt?: Date | string | null;
  status?: string;
  compact?: boolean;
}

function getTimeRemaining(dueAt: Date): {
  label: string;
  color: "green" | "yellow" | "red" | "gray";
  percentage: number;
} {
  const now = new Date();
  const diff = dueAt.getTime() - now.getTime();
  const hoursRemaining = diff / (1000 * 60 * 60);

  if (hoursRemaining <= 0) {
    const hoursOverdue = Math.abs(hoursRemaining);
    return {
      label: hoursOverdue < 1
        ? `Vencido hace ${Math.round(hoursOverdue * 60)} min`
        : `Vencido hace ${Math.round(hoursOverdue)}h`,
      color: "red",
      percentage: 100,
    };
  }

  if (hoursRemaining <= 4) {
    return {
      label: hoursRemaining < 1
        ? `${Math.round(hoursRemaining * 60)} min restantes`
        : `${Math.round(hoursRemaining)}h restantes`,
      color: "red",
      percentage: 90,
    };
  }

  if (hoursRemaining <= 12) {
    return {
      label: `${Math.round(hoursRemaining)}h restantes`,
      color: "yellow",
      percentage: 60,
    };
  }

  if (hoursRemaining < 48) {
    return {
      label: `${Math.round(hoursRemaining)}h restantes`,
      color: "green",
      percentage: 30,
    };
  }

  const days = Math.round(hoursRemaining / 24);
  return {
    label: `${days} días restantes`,
    color: "green",
    percentage: 10,
  };
}

const COLOR_CLASSES = {
  green: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
    dot: "bg-green-500",
    bar: "bg-green-500",
  },
  yellow: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-400",
    dot: "bg-yellow-500",
    bar: "bg-yellow-500",
  },
  red: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-500",
    bar: "bg-red-500",
  },
  gray: {
    bg: "bg-gray-100 dark:bg-gray-900/30",
    text: "text-gray-700 dark:text-gray-400",
    dot: "bg-gray-400",
    bar: "bg-gray-400",
  },
};

export function SlaIndicator({ dueAt, completedAt, status, compact = false }: SlaIndicatorProps) {
  if (!dueAt) return null;

  const dueDate = new Date(dueAt);

  // If task is completed, show if it was on time or late
  if (completedAt || status === "FINALIZADA" || status === "CANCELADA") {
    if (completedAt) {
      const completedDate = new Date(completedAt);
      const wasOnTime = completedDate <= dueDate;
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex items-center gap-1 text-xs ${
                  wasOnTime ? "text-green-600" : "text-red-600"
                }`}
              >
                {wasOnTime ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )}
                {compact ? "" : wasOnTime ? "En tiempo" : "Fuera de SLA"}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                SLA: {dueDate.toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
              <p>
                Completada: {completedDate.toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return null;
  }

  const { label, color } = getTimeRemaining(dueDate);
  const classes = COLOR_CLASSES[color];

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center gap-1 ${classes.text}`}>
              <span className={`h-2 w-2 rounded-full ${classes.dot}`} />
              {color === "red" && <AlertTriangle className="h-3 w-3" />}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">SLA: {label}</p>
            <p className="text-xs text-muted-foreground">
              Vence: {dueDate.toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${classes.bg} ${classes.text}`}>
      {color === "red" ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {label}
    </div>
  );
}
