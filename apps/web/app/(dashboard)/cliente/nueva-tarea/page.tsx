"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { TASK_CATEGORY_LABELS, TASK_CATEGORY_BADGE_COLORS, getClientTaskPhrase } from "@isytask/shared";
import { Clock, Info, FileText, X, Sparkles, Upload, CheckCircle2, Paperclip, Trash2, Loader2, Bot, Rocket, Plus, MessageSquareText } from "lucide-react";
import { ChatPanel } from "@/components/ai-chat/chat-panel";

export default function NuevaTareaPage() {
  const router = useRouter();
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"URGENTE" | "NORMAL" | "LARGO_PLAZO">("NORMAL");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [skippedFields, setSkippedFields] = useState<Set<string>>(new Set());
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<
    Array<{ url: string; storagePath: string; fileName: string; fileSize: number; mimeType: string }>
  >([]);
  const [uploading, setUploading] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [aiCategoryTitle, setAiCategoryTitle] = useState("");
  const [userOverrodeCategory, setUserOverrodeCategory] = useState(false);
  // Optional context — surfaced via toggle, not required. Captures *why*.
  const [showPurpose, setShowPurpose] = useState(false);
  const [purpose, setPurpose] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: services } = trpc.services.list.useQuery();
  const { data: templates } = trpc.templates.list.useQuery({ activeOnly: true });
  const { data: formFields } = trpc.services.getFormFields.useQuery(
    { serviceId: selectedServiceId },
    { enabled: !!selectedServiceId }
  );
  const selectedService = services?.find((s) => s.id === selectedServiceId);
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());

  // AI category suggestion — fires when title has 10+ chars
  const { data: aiCategory, isFetching: aiCategoryLoading } = trpc.tasks.suggestCategory.useQuery(
    { title: aiCategoryTitle, description, serviceName: selectedService?.name },
    { enabled: aiCategoryTitle.length >= 10 && !userOverrodeCategory }
  );

  // Debounce title changes for AI suggestion
  useEffect(() => {
    if (userOverrodeCategory) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (title.length >= 10) setAiCategoryTitle(title);
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [title, description, userOverrodeCategory]);

  // Apply AI suggestion when it arrives
  useEffect(() => {
    if (aiCategory?.category && aiCategory.confidence === "high" && !userOverrodeCategory) {
      setCategory(aiCategory.category as "URGENTE" | "NORMAL" | "LARGO_PLAZO");
    }
  }, [aiCategory, userOverrodeCategory]);

  // Check if selected service has AI agent enabled
  const { data: agentConfig } = trpc.services.getAgentConfig.useQuery(
    { serviceId: selectedServiceId },
    { enabled: !!selectedServiceId }
  );
  const showAIChat = agentConfig?.agentEnabled ?? false;

  // Handle AI updating form fields with visual highlight
  const handleAIFieldsUpdate = useCallback((updates: Record<string, any>) => {
    setFormData((prev) => {
      const merged = { ...prev };
      for (const [key, value] of Object.entries(updates)) {
        // Only auto-fill fields that are empty or were previously auto-filled
        if (!prev[key] || prev[key] === "" || prev[key] === undefined) {
          merged[key] = value;
        }
      }
      return merged;
    });

    // Highlight the updated fields briefly
    const fieldNames = new Set(Object.keys(updates));
    setHighlightedFields(fieldNames);
    setTimeout(() => setHighlightedFields(new Set()), 1500);
  }, []);

  // Filter templates for selected service (or all if none selected)
  const relevantTemplates = templates?.filter(
    (t) => !selectedServiceId || t.serviceId === selectedServiceId
  );

  const addAttachmentMutation = trpc.tasks.addAttachment.useMutation();

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: async (task) => {
      // Attach any pending files to the created task
      if (pendingFiles.length > 0) {
        try {
          await Promise.all(
            pendingFiles.map((file) =>
              addAttachmentMutation.mutateAsync({
                taskId: task.id,
                fileName: file.fileName,
                fileSize: file.fileSize,
                mimeType: file.mimeType,
                url: file.url,
                storagePath: file.storagePath,
                isDeliverable: false,
              })
            )
          );
        } catch {
          // Files failed but task was created — still redirect
        }
      }
      // Show motivational toast before redirect
      setSuccessToast(getClientTaskPhrase());
      setTimeout(() => router.push("/cliente"), 3000);
    },
  });

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const toggleSkipField = (fieldName: string) => {
    setSkippedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldName)) {
        next.delete(fieldName);
      } else {
        next.add(fieldName);
        // Clear the field value when skipping
        setFormData((prevData) => {
          const copy = { ...prevData };
          delete copy[fieldName];
          return copy;
        });
      }
      return next;
    });
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
    setPurpose("");
    setShowPurpose(false);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          alert(`"${file.name}" excede el límite de 10MB`);
          continue;
        }
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/uploads/file", {
          method: "POST",
          body: fd,
        });
        if (res.ok) {
          const data = await res.json();
          setPendingFiles((prev) => [
            ...prev,
            {
              url: data.url,
              storagePath: data.storagePath,
              fileName: data.fileName,
              fileSize: data.fileSize,
              mimeType: data.mimeType,
            },
          ]);
        } else {
          alert(`Error al subir "${file.name}"`);
        }
      }
    } catch {
      alert("Error al subir archivos");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
      skippedFields: skippedFields.size > 0 ? Array.from(skippedFields) : undefined,
      purpose: purpose.trim() ? purpose.trim() : undefined,
    });
  };

  return (
    <>
      <Topbar title="Nueva Solicitud de Tarea" />
      <div className={`p-4 md:p-6 ${showAIChat ? "max-w-6xl" : "max-w-2xl"} mx-auto space-y-6`}>
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

        {/* Split-view wrapper when AI Chat is active, otherwise just the form */}
        <div className={showAIChat && selectedServiceId ? "flex flex-col lg:flex-row gap-6" : ""}>
          {/* Chat Panel — only when AI Chat is active */}
          {showAIChat && selectedServiceId && (
            <div className="w-full lg:w-[55%]">
              <ChatPanel
                serviceId={selectedServiceId}
                serviceName={agentConfig?.serviceName || selectedService?.name || ""}
                formData={formData}
                onFieldsUpdate={handleAIFieldsUpdate}
              />
            </div>
          )}

          {/* Form Panel */}
          <div className={showAIChat && selectedServiceId ? "w-full lg:w-[45%] space-y-3" : ""}>
            {showAIChat && selectedServiceId && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                <Bot className="h-4 w-4 text-primary flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  El asistente IA irá llenando los campos automáticamente. Puedes editarlos manualmente.
                </p>
              </div>
            )}
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
                        setSkippedFields(new Set());
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
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">Categoría</label>
                      {aiCategoryLoading && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Sparkles className="h-3 w-3 animate-pulse text-violet-500" />
                          Analizando...
                        </span>
                      )}
                      {aiCategory?.confidence === "high" && !userOverrodeCategory && !aiCategoryLoading && (
                        <span className="flex items-center gap-1 text-xs text-violet-600">
                          <Sparkles className="h-3 w-3" />
                          Sugerido por IA
                        </span>
                      )}
                    </div>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value as any);
                        setUserOverrodeCategory(true);
                      }}
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

                  {/* Optional purpose / context — toggle to keep flow lean */}
                  {!showPurpose ? (
                    <button
                      type="button"
                      onClick={() => setShowPurpose(true)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Agregar contexto
                      <span className="text-muted-foreground/60">— cuéntanos por qué (opcional)</span>
                    </button>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium flex items-center gap-1.5">
                          <MessageSquareText className="h-3 w-3" />
                          ¿Por qué necesitas esta tarea?
                          <span className="text-muted-foreground font-normal">(opcional)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPurpose(false);
                            setPurpose("");
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Quitar
                        </button>
                      </div>
                      <textarea
                        className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        placeholder="Ej: Estamos lanzando un producto nuevo el viernes y necesitamos esto antes…"
                        maxLength={1000}
                      />
                      <p className="text-[10px] text-muted-foreground/70">
                        Este contexto nos ayuda a priorizar mejor y a entender lo que es importante para ti.
                      </p>
                    </div>
                  )}

                  {/* Dynamic form fields */}
                  {formFields && formFields.length > 0 && (
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-medium">Detalles del servicio</h3>
                      {formFields.map((field) => {
                        const isSkipped = skippedFields.has(field.fieldName);
                        return (
                        <div
                          key={field.id}
                          className={`space-y-2 rounded-lg transition-all duration-700 ${
                            isSkipped ? "opacity-50" : ""
                          } ${
                            highlightedFields.has(field.fieldName)
                              ? "ring-2 ring-primary/40 bg-primary/5 p-2"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">
                              {field.label}
                              {field.isRequired && <span className="text-destructive ml-1">*</span>}
                            </label>
                            {!field.isRequired && (
                              <button
                                type="button"
                                onClick={() => toggleSkipField(field.fieldName)}
                                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                                  isSkipped
                                    ? "bg-muted text-muted-foreground border-muted-foreground/30"
                                    : "text-muted-foreground/60 border-transparent hover:border-muted-foreground/30"
                                }`}
                              >
                                {isSkipped ? "Omitido" : "No aplica"}
                              </button>
                            )}
                          </div>

                          {isSkipped ? (
                            <p className="text-xs text-muted-foreground italic">Campo omitido — no aplica</p>
                          ) : (
                            <>
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

                          {field.fieldType === "FILE" && (
                            <div>
                              <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                                <Upload className="h-5 w-5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {formData[field.fieldName]
                                    ? `Archivo seleccionado`
                                    : "Haz clic para seleccionar un archivo"}
                                </span>
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const fd = new FormData();
                                    fd.append("file", file);
                                    try {
                                      const res = await fetch("/api/uploads/file", {
                                        method: "POST",
                                        body: fd,
                                      });
                                      if (res.ok) {
                                        const data = await res.json();
                                        handleFieldChange(field.fieldName, data.url);
                                      } else {
                                        alert("Error al subir archivo");
                                      }
                                    } catch {
                                      alert("Error al subir archivo");
                                    }
                                  }}
                                />
                              </label>
                              {formData[field.fieldName] && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Archivo subido correctamente
                                </p>
                              )}
                            </div>
                          )}
                            </>
                          )}
                        </div>
                      );
                      })}
                    </div>
                  )}

                  {/* File Attachments */}
                  <div className="space-y-3 border-t pt-4">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Paperclip className="h-4 w-4" />
                      Archivos adjuntos
                      <span className="text-muted-foreground font-normal">(opcional)</span>
                    </label>

                    {/* Uploaded files list */}
                    {pendingFiles.length > 0 && (
                      <div className="space-y-2">
                        {pendingFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/30"
                          >
                            <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{file.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.fileSize)}
                              </p>
                            </div>
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <button
                              type="button"
                              onClick={() => removeFile(idx)}
                              className="p-1 rounded hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload area */}
                    <label
                      className="flex flex-col items-center gap-2 p-5 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add("border-primary", "bg-primary/5");
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                        handleFileUpload(e.dataTransfer.files);
                      }}
                    >
                      {uploading ? (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      ) : (
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground text-center">
                        {uploading
                          ? "Subiendo archivos..."
                          : "Arrastra archivos aquí o haz clic para seleccionar"}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        Máximo 10MB por archivo
                      </span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => handleFileUpload(e.target.files)}
                      />
                    </label>
                  </div>

                  {/* Submit */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button type="submit" disabled={createMutation.isLoading || uploading}>
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
        </div>
      </div>

      {/* Client motivational toast on task creation */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-in slide-in-from-bottom-5 fade-in duration-500">
          <div className="relative flex items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-sm bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30">
            <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center bg-green-500/20">
              <Rocket className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                ¡Tarea enviada!
              </p>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                {successToast}
              </p>
            </div>
            <button
              onClick={() => {
                setSuccessToast(null);
                router.push("/cliente");
              }}
              className="flex-shrink-0 p-0.5 rounded-md hover:bg-muted/50 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
