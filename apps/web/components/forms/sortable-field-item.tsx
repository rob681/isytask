"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FieldItem {
  id: string;
  fieldName: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  sortOrder: number;
  placeholder?: string | null;
  options?: any;
  validation?: any;
}

interface SortableFieldItemProps {
  field: FieldItem;
  onEdit: (field: FieldItem) => void;
  onDelete: (id: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: "Texto",
  TEXTAREA: "Área de texto",
  NUMBER: "Número",
  SELECT: "Selector",
  MULTISELECT: "Multi-selector",
  CHECKBOX: "Casilla",
  COLOR_PICKER: "Color",
  FILE: "Archivo",
  DATE: "Fecha",
  URL: "URL",
};

export function SortableFieldItem({
  field,
  onEdit,
  onDelete,
  isExpanded,
  onToggleExpand,
}: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg bg-card p-3"
    >
      <div className="flex items-center gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        {/* Field info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{field.label}</span>
            {field.isRequired && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                Requerido
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">
              {FIELD_TYPE_LABELS[field.fieldType] ?? field.fieldType}
            </Badge>
            <span className="text-xs">{field.fieldName}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(field)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(field.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-3 pl-8 space-y-1 text-sm text-muted-foreground border-t pt-3">
          {field.placeholder && (
            <p>Placeholder: <span className="text-foreground">{field.placeholder}</span></p>
          )}
          {field.options && Array.isArray(field.options) && field.options.length > 0 && (
            <p>
              Opciones:{" "}
              <span className="text-foreground">
                {(field.options as string[]).join(", ")}
              </span>
            </p>
          )}
          {field.validation && (
            <p>
              Validación:{" "}
              <span className="text-foreground">
                {JSON.stringify(field.validation)}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
