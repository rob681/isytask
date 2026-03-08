"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Trash2 } from "lucide-react";

interface FieldFormData {
  id?: string;
  fieldName: string;
  label: string;
  fieldType: string;
  placeholder: string;
  isRequired: boolean;
  options: string[];
  validation: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
}

const FIELD_TYPES = [
  { value: "TEXT", label: "Texto" },
  { value: "TEXTAREA", label: "Área de texto" },
  { value: "NUMBER", label: "Número" },
  { value: "SELECT", label: "Selector" },
  { value: "MULTISELECT", label: "Multi-selector" },
  { value: "CHECKBOX", label: "Casilla" },
  { value: "COLOR_PICKER", label: "Selector de color" },
  { value: "FILE", label: "Archivo" },
  { value: "DATE", label: "Fecha" },
  { value: "URL", label: "URL" },
];

const TYPES_WITH_OPTIONS = ["SELECT", "MULTISELECT"];
const TYPES_WITH_NUMBER_VALIDATION = ["NUMBER"];
const TYPES_WITH_TEXT_VALIDATION = ["TEXT", "TEXTAREA", "URL"];

interface FieldFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: FieldFormData) => void;
  initialData?: FieldFormData | null;
  isLoading?: boolean;
}

const emptyForm: FieldFormData = {
  fieldName: "",
  label: "",
  fieldType: "TEXT",
  placeholder: "",
  isRequired: false,
  options: [],
  validation: {},
};

export function FieldFormModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  isLoading,
}: FieldFormModalProps) {
  const [form, setForm] = useState<FieldFormData>(emptyForm);
  const [newOption, setNewOption] = useState("");

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    } else {
      setForm(emptyForm);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEditing = !!initialData?.id;
  const showOptions = TYPES_WITH_OPTIONS.includes(form.fieldType);
  const showNumberValidation = TYPES_WITH_NUMBER_VALIDATION.includes(form.fieldType);
  const showTextValidation = TYPES_WITH_TEXT_VALIDATION.includes(form.fieldType);

  const handleAddOption = () => {
    if (newOption.trim()) {
      setForm((f) => ({ ...f, options: [...f.options, newOption.trim()] }));
      setNewOption("");
    }
  };

  const handleRemoveOption = (index: number) => {
    setForm((f) => ({
      ...f,
      options: f.options.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const autoFieldName = (label: string) =>
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">
            {isEditing ? "Editar Campo" : "Nuevo Campo"}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Label */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Etiqueta</label>
            <Input
              value={form.label}
              onChange={(e) => {
                const label = e.target.value;
                setForm((f) => ({
                  ...f,
                  label,
                  ...(!isEditing && { fieldName: autoFieldName(label) }),
                }));
              }}
              placeholder="Ej: Número de pestañas"
              required
            />
          </div>

          {/* Field name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre técnico</label>
            <Input
              value={form.fieldName}
              onChange={(e) =>
                setForm((f) => ({ ...f, fieldName: e.target.value }))
              }
              placeholder="Ej: num_pestanas"
              required
              disabled={isEditing}
              pattern="^[a-z_][a-z0-9_]*$"
              title="Solo letras minúsculas, números y guiones bajos"
            />
            <p className="text-xs text-muted-foreground">
              Se genera automáticamente. Solo minúsculas y guiones bajos.
            </p>
          </div>

          {/* Field type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de campo</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.fieldType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  fieldType: e.target.value,
                  options: [],
                  validation: {},
                }))
              }
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Placeholder */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Placeholder</label>
            <Input
              value={form.placeholder}
              onChange={(e) =>
                setForm((f) => ({ ...f, placeholder: e.target.value }))
              }
              placeholder="Texto de ayuda dentro del campo"
            />
          </div>

          {/* Required */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              checked={form.isRequired}
              onChange={(e) =>
                setForm((f) => ({ ...f, isRequired: e.target.checked }))
              }
            />
            <span className="text-sm font-medium">Campo requerido</span>
          </label>

          {/* Options (for SELECT/MULTISELECT) */}
          {showOptions && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Opciones</label>
              <div className="space-y-1">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-sm bg-muted px-3 py-1.5 rounded">
                      {opt}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleRemoveOption(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Nueva opción"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddOption();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddOption}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Number validation */}
          {showNumberValidation && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Validación numérica</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Mínimo</label>
                  <Input
                    type="number"
                    value={form.validation.min ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        validation: {
                          ...f.validation,
                          min: e.target.value ? Number(e.target.value) : undefined,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Máximo</label>
                  <Input
                    type="number"
                    value={form.validation.max ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        validation: {
                          ...f.validation,
                          max: e.target.value ? Number(e.target.value) : undefined,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Text validation */}
          {showTextValidation && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Validación de texto</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">
                    Longitud mínima
                  </label>
                  <Input
                    type="number"
                    value={form.validation.minLength ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        validation: {
                          ...f.validation,
                          minLength: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    Longitud máxima
                  </label>
                  <Input
                    type="number"
                    value={form.validation.maxLength ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        validation: {
                          ...f.validation,
                          maxLength: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? "Guardando..."
                : isEditing
                  ? "Guardar Cambios"
                  : "Agregar Campo"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
