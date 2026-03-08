"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  colorClass: string;
  children: React.ReactNode;
}

export function KanbanColumn({
  id,
  title,
  count,
  colorClass,
  children,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-72 min-w-[288px] rounded-xl border-t-4 bg-muted/30 border transition-colors",
        colorClass,
        isOver && "bg-primary/5 border-primary/30"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b bg-card/50 rounded-t-lg">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="flex items-center justify-center h-6 min-w-[24px] rounded-full bg-muted text-xs font-medium px-1.5">
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-240px)]">
        {children}
      </div>
    </div>
  );
}
