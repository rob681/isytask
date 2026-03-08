"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { TASK_CATEGORY_LABELS, TASK_CATEGORY_BADGE_COLORS } from "@isytask/shared";
import { Clock, Info, FileText, X, Sparkles } from "lucide-react";

export default function NuevaTareaPage() {
  const router = useRouter();
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"URGENTE" | "NORMAL" | "LARGO_PLAZO">("NORMAL");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);

  const { data: services } = trpc.services.list.useQuery();
  const { data: templates } = trpc.templates.list.useQuery({ activeOnly: true });
  const { data: formFields } = trpc.services.getFormFields.useQuery(
    { serviceId: selectedServiceId },
    { enabled: !!selectedServiceId }
  );
  const selectedService = services?.find((s) => s.id === selectedServiceId);

  // Filter templates for selected service (or all if none selected)
  const relevantTemplates = templates?.filter(
    (t) => !selectedServiceId || t.serviceId === selectedServiceId
  );

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      router.push("/cliente");
    },
  });

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const applyTemplate = (template: any) => {
    setSelectedServiceId(template.serviceId);
    setTitle(template.name);
    setDescription(template.description ?? "");
    setCategory(template.category);
    if (template.formData && typeof template.formData === "object") {
      setFormData(template.formData as Record<string, any>);
    } else {
      setFormData({});
    }
    setAppliedTemplateId(template.id);
  };

  const clearTemplate = () => {
    setAppliedTemplateId(null);
    setSelectedServiceId("");
    setTitle("");
    setDescription("");
    setCategory("NORMAL");
    setFormData({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceId || !title) return;

    createMutation.mutate({
      serviceId: selectedServiceId,
      title,
      description,
      category,
      formData,
    });
  };

  return (
    <>
      <Topbar title="Nueva Solicitud de Tarea" />
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Template Selector */}
        {relevantTemplates && relevantTemplates.length > 0 && !appliedTemplateId && (
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Plantillas Rápidas
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Selecciona una plantilla para pre-llenar el formulario
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {relevantTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
                  >
                    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{template.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">
                          {template.service.name}
                        </span>
                        <Badge className={`text-[9px] ${TASK_CATEGORY_BADGE_COLORS[template.category]}`}>
                          {TASK_CATEGORY_LABELS[template.category]}
                        </Badge>
                      </div>
                      {template.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Applied template badge */}
        {appliedTemplateId && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm text-primary font-medium">Plantilla aplicada</span>
            <span className="text-xs text-muted-foreground">— Puedes modificar los campos</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-xs"
              onClick={clearTemplate}
            >
              <X className="h-3 w-3 mr-1" />
              Quitar
            </Button>
          </div>
        )}

        {/* Main Form */}
        <Card>
          <CardHeader>
            <CardTitle>Tarea</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Service type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de tarea</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedServiceId}
                  onChange={(e) => {
                    setSelectedServiceId(e.target.value);
                    setFormData({});
                    setAppliedTemplateId(null);
                  }}
                  required
                >
                  <option value="">Selecciona un servicio</option>
                  {services?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {selectedService && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Tiempo estimado de tarea: {selectedService.estimatedHours} hrs.
                    </p>
                    <p className="text-xs text-muted-foreground/80 flex items-start gap-1 pl-0.5">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      Los tiempos son aproximados y pueden variar según el tipo de tarea o ajustes por parte de los clientes.
                    </p>
                  </div>
                )}
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                >
                  <option value="NORMAL">Normal</option>
                  <option value="URGENTE">Urgente</option>
                  <option value="LARGO_PLAZO">Largo plazo</option>
                </select>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Título de la solicitud</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Rediseño de la página de inicio"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Descripción general</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe lo que necesitas..."
                />
              </div>

              {/* Dynamic form fields */}
              {formFields && formFields.length > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-medium">Detalles del servicio</h3>
                  {formFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <label className="text-sm font-medium">
                        {field.label}
                        {field.isRequired && <span className="text-destructive ml-1">*</span>}
                      </label>

                      {field.fieldType === "TEXT" && (
                        <Input
                          placeholder={field.placeholder ?? ""}
                          value={formData[field.fieldName] ?? ""}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                          required={field.isRequired}
                        />
                      )}

                      {field.fieldType === "TEXTAREA" && (
                        <textarea
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                          placeholder={field.placeholder ?? ""}
                          value={formData[field.fieldName] ?? ""}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                          required={field.isRequired}
                        />
                      )}

                      {field.fieldType === "NUMBER" && (
                        <Input
                          type="number"
                          placeholder={field.placeholder ?? ""}
                          value={formData[field.fieldName] ?? ""}
                          onChange={(e) => handleFieldChange(field.fieldName, Number(e.target.value))}
                          required={field.isRequired}
                          min={(field.validation as any)?.min}
                          max={(field.validation as any)?.max}
                        />
                      )}

                      {field.fieldType === "SELECT" && (
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={formData[field.fieldName] ?? ""}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                          required={field.isRequired}
                        >
                          <option value="">Selecciona una opción</option>
                          {(field.options as string[])?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {field.fieldType === "MULTISELECT" && (
                        <div className="flex flex-wrap gap-2">
                          {(field.options as string[])?.map((opt) => {
                            const selected = (formData[field.fieldName] as string[]) ?? [];
                            const isSelected = selected.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background border-input hover:bg-accent"
                                }`}
                                onClick={() => {
                                  handleFieldChange(
                                    field.fieldName,
                                    isSelected
                                      ? selected.filter((s: string) => s !== opt)
                                      : [...selected, opt]
                                  );
                                }}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {field.fieldType === "URL" && (
                        <Input
                          type="url"
                          placeholder={field.placeholder ?? "https://"}
                          value={formData[field.fieldName] ?? ""}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                          required={field.isRequired}
                        />
                      )}

                      {field.fieldType === "COLOR_PICKER" && (
                        <input
                          type="color"
                          className="h-10 w-20 rounded-md border border-input cursor-pointer"
                          value={formData[field.fieldName] ?? "#000000"}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                        />
                      )}

                      {field.fieldType === "CHECKBOX" && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-input"
                            checked={formData[field.fieldName] ?? false}
                            onChange={(e) => handleFieldChange(field.fieldName, e.target.checked)}
                          />
                          <span className="text-sm">{field.placeholder ?? "Sí"}</span>
                        </label>
                      )}

                      {field.fieldType === "DATE" && (
                        <Input
                          type="date"
                          value={formData[field.fieldName] ?? ""}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                          required={field.isRequired}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-2 pt-4 border-t">
                <Button type="submit" disabled={createMutation.isLoading}>
                  {createMutation.isLoading ? "Enviando..." : "Enviar Solicitud"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancelar
                </Button>
              </div>

              {createMutation.error && (
                <p className="text-sm text-destructive">
                  {createMutation.error.message}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
