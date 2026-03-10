"use client";

import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import {
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_BADGE_COLORS,
} from "@isytask/shared";
import { Clock, MessageCircle, Paperclip, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskData {
  id: string;
  taskNumber: number;
  title: string;
  status: string;
  category: string;
  estimatedHours: number;
  extraHours: number;
  client: {
    user: { name: string | null };
    companyName?: string | null;
  };
  service: { name: string };
  colaborador?: {
    user: { name: string | null };
  } | null;
  _count: { comments: number; attachments: number };
}

interface KanbanCardProps {
  task: TaskData;
  onClick?: () => void;
  isDragOverlay?: boolean;
}

export function KanbanCard({ task, onClick, isDragOverlay }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } =
    useDraggable({
      id: task.id,
      disabled: isDragOverlay, // Overlay cards must NOT register as draggable
    });

  // DragOverlay renders a visual-only copy — no dnd refs/listeners.
  // The original card stays in place (faded) while DragOverlay follows the cursor.
  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      {...(isDragOverlay ? {} : { ...listeners, ...attributes })}
      onClick={isDragging ? undefined : onClick}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm transition-colors",
        !isDragOverlay && "cursor-grab active:cursor-grabbing hover:border-primary/40",
        isDragging && "opacity-30",
        isDragOverlay && "shadow-xl border-primary/50 ring-2 ring-primary/20"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-xs font-mono text-muted-foreground">
          #{task.taskNumber}
        </span>
        <Badge
          className={`text-[10px] shrink-0 ${
            TASK_CATEGORY_BADGE_COLORS[task.category as keyof typeof TASK_CATEGORY_BADGE_COLORS]
          }`}
        >
          {TASK_CATEGORY_LABELS[task.category as keyof typeof TASK_CATEGORY_LABELS]}
        </Badge>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium line-clamp-2 mb-2">{task.title}</h4>

      {/* Client & Service */}
      <p className="text-xs text-muted-foreground truncate mb-2">
        {(task.client as any).companyName || task.client.user.name} · {task.service.name}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {task.estimatedHours + task.extraHours}h
          </span>
          {task._count.comments > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" />
              {task._count.comments}
            </span>
          )}
          {task._count.attachments > 0 && (
            <span className="flex items-center gap-0.5">
              <Paperclip className="h-3 w-3" />
              {task._count.attachments}
            </span>
          )}
        </div>
        {task.colaborador && (
          <span className="flex items-center gap-0.5 truncate max-w-[100px]">
            <User className="h-3 w-3 flex-shrink-0" />
            {task.colaborador.user.name?.split(" ")[0]}
          </span>
        )}
      </div>
    </div>
  );
}
