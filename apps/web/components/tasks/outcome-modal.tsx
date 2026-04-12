"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Star, X } from "lucide-react";

interface OutcomeModalProps {
  open: boolean;
  taskTitle: string;
  isLoading?: boolean;
  errorMessage?: string;
  onClose: () => void;
  onConfirm: (data: {
    outcomeNote?: string;
    outcomeRating?: number;
    note?: string;
  }) => void;
}

/**
 * Captures completion outcome when transitioning a task to FINALIZADA.
 * Both outcome fields are optional — user can skip and just confirm.
 * Feeds future agent memory (see project_isyagent.md).
 */
export function OutcomeModal({
  open,
  taskTitle,
  isLoading,
  errorMessage,
  onClose,
  onConfirm,
}: OutcomeModalProps) {
  const [outcomeNote, setOutcomeNote] = useState("");
  const [outcomeRating, setOutcomeRating] = useState<number | undefined>();
  const [hoverRating, setHoverRating] = useState<number | undefined>();

  // Reset form when modal closes/reopens
  useEffect(() => {
    if (open) {
      setOutcomeNote("");
      setOutcomeRating(undefined);
      setHoverRating(undefined);
    }
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm({
      outcomeNote: outcomeNote.trim() ? outcomeNote.trim() : undefined,
      outcomeRating,
    });
  };

  const displayRating = hoverRating ?? outcomeRating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-background shadow-lg border">
        <div className="flex items-start justify-between border-b p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-green-100 p-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold">Marcar como finalizada</h3>
              <p className="text-xs text-muted-foreground line-clamp-1">{taskTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* Rating */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              ¿Cómo salió?
              <span className="ml-1 text-xs text-muted-foreground font-normal">(opcional)</span>
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(undefined)}
                  onClick={() =>
                    setOutcomeRating((prev) => (prev === n ? undefined : n))
                  }
                  className="p-1 transition-transform hover:scale-110"
                  aria-label={`${n} de 5`}
                >
                  <Star
                    className={`h-6 w-6 ${
                      displayRating && n <= displayRating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
              {outcomeRating && (
                <button
                  type="button"
                  onClick={() => setOutcomeRating(undefined)}
                  className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Outcome note */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Notas del cierre
              <span className="ml-1 text-xs text-muted-foreground font-normal">(opcional)</span>
            </label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={outcomeNote}
              onChange={(e) => setOutcomeNote(e.target.value)}
              placeholder="Ej: Quedó perfecto al primer intento, el cliente lo aprobó sin cambios."
              maxLength={1000}
            />
            <p className="text-[10px] text-muted-foreground/70">
              Esto ayuda a aprender qué funciona bien para tareas similares en el futuro.
            </p>
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t p-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isLoading}>
            <CheckCircle className="h-4 w-4 mr-1" />
            {isLoading ? "Finalizando..." : "Finalizar tarea"}
          </Button>
        </div>
      </div>
    </div>
  );
}
