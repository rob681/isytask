"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { Clock, UserCircle, Users, Info, X, Star, UserPlus, Sparkles, Bot, Plus, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ChatPanel } from "@/components/ai-chat/chat-panel";

export default function AdminNuevaTareaPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<Array<{ id: string; name: string; isUser?: boolean }>>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"URGENTE" | "NORMAL" | "LARGO_PLAZO">("NORMAL");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());
  const [aiCategoryTitle, setAiCategoryTitle] = useState("");
  const [userOverrodeCategory, setUserOverrodeCategory] = useState(false);
  const [showPurpose, setShowPurpose] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [descSuggestInput, setDescSuggestInput] = useState<{ serviceName: string; title?: string; fieldValues?: Record<string, string> } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch data
  const { data: clientsData } = trpc.clients.list.useQuery({
    page: 1,
    pageSize: 100,
  });
  const { data: services } = trpc.services.list.useQuery();
  const { data: teamData } = trpc.users.list.useQuery({
    role: "COLABORADOR",
    page: 1,
    pageSize: 50,
  });

  const { data: formFields } = trpc.services.getFormFields.useQuery(
    { serviceId: selectedServiceId },
    { enabled: !!selectedServiceId }
  );

  const selectedService = services?.find((s) => s.id === selectedServiceId);
  const colaboradores = teamData?.users.filter((u) => u.colaboradorProfile) ?? [];

  // AI category suggestion
  const { data: aiCategory } = trpc.tasks.suggestCategory.useQuery(
    { title: aiCategoryTitle, description, serviceName: selectedService?.name },
    { enabled: aiCategoryTitle.length >= 10 && !userOverrodeCategory }
  );

  useEffect(() => {
    if (userOverrodeCategory) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (title.length >= 10) setAiCategoryTitle(title);
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [title, description, userOverrodeCategory]);

  useEffect(() => {
    if (aiCategory?.category && aiCategory.confidence === "high" && !userOverrodeCategory) {
      setCategory(aiCategory.category as "URGENTE" | "NORMAL" | "LARGO_PLAZO");
    }
  }, [aiCategory, userOverrodeCategory]);

  // AI chat panel
  const { data: agentConfig } = trpc.services.getAgentConfig.useQuery(
    { serviceId: selectedServiceId },
    { enabled: !!selectedServiceId }
  );
  const showAIChat = agentConfig?.agentEnabled ?? false;

  const handleAIFieldsUpdate = useCallback((updates: Record<string, any>) => {
    setFormData((prev) => {
      const merged = { ...prev };
      for (const [key, value] of Object.entries(updates)) {
        if (!prev[key] || prev[key] === "" || prev[key] === undefined) {
          merged[key] = value;
        }
      }
      return merged;
    });
    setHighlightedFields(new Set(Object.keys(updates)));
    setTimeout(() => setHighlightedFields(new Set()), 1500);
  }, []);

  // AI smart assignment suggestion
  const { data: aiAssignment } = trpc.tasks.suggestAssignment.useQuery(
    { serviceId: selectedServiceId, clientId: selectedClientId || undefined, category },
    { enabled: !!selectedServiceId }
  );

  // AI description suggestion
  const { data: descSuggestData, isFetching: descFetching } = trpc.tasks.suggestDescription.useQuery(
    descSuggestInput ?? { serviceName: "" },
    { enabled: !!descSuggestInput }
  );

  useEffect(() => {
    if (descSuggestData?.suggestion) {
      setAiSuggestion(descSuggestData.suggestion);
      setLoadingAI(false);
    }
  }, [descSuggestData]);

  useEffect(() => {
    if (descFetching) setLoadingAI(true);
    else setLoadingAI(false);
  }, [descFetching]);

  const triggerDescSuggest = () => {
    if (!selectedService) return;
    const stringFieldValues: Record<string, string> = {};
    for (const [k, v] of Object.entries(formData)) {
      if (v !== null && v !== undefined && String(v).trim()) {
        stringFieldValues[k] = String(v);
      }
    }
    setAiSuggestion("");
    setDescSuggestInput({
      serviceName: selectedService.name,
      title: title || undefined,
      fieldValues: Object.keys(stringFieldValues).length > 0 ? stringFieldValues : undefined,
    });
  };

  const createMutation = trpc.tasks.createForClient.useMutation({
    onSuccess: () => {
      router.push("/admin/tareas");
    },
  });

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleAddAssignee = (value: string) => {
    if (!value) return;
    const isUser = value.startsWith("user:");
    const name = isUser
      ? (session?.user?.name ?? "Yo")
      : colaboradores.find((c) => c.colaboradorProfile!.id === value)?.name ?? "Colaborador";
    if (selectedAssignees.some((a) => a.id === value)) return;
    setSelectedAssignees((prev) => [...prev, { id: value, name, isUser }]);
  };

  const handleRemoveAssignee = (id: string) => {
    setSelectedAssignees((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !selectedServiceId || !title) return;

    // First assignee is primary, rest are helpers
    const primary = selectedAssignees[0];
    const helpers = selectedAssignees.slice(1);

    const primaryIsUser = primary?.isUser;
    const helperColabIds = helpers
      .filter((h) => !h.isUser)
      .map((h) => h.id);

    createMutation.mutate({
      clientId: selectedClientId,
      serviceId: selectedServiceId,
      title,
      description,
      category,
      formData,
      ...(purpose.trim() && { purpose: purpose.trim() }),
      ...(primary && !primaryIsUser && { colaboradorId: primary.id }),
      ...(primary && primaryIsUser && { assignToUserId: primary.id.replace("user:", "") }),
      ...(helperColabIds.length > 0 && { additionalAssignees: helperColabIds }),
    });
  };

  return (
    <>
      <Topbar title="Crear Tarea" />
      <div className={`p-4 md:p-6 mx-auto ${showAIChat ? "max-w-5xl" : "max-w-2xl"}`}>
        <div className={showAIChat ? "grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6" : ""}>
        <Card>
          <CardHeader>
            <CardTitle>Nueva Tarea</CardTitle>
            <CardDescription>
              Crea una tarea en nombre de un cliente o asignala directamente a un colaborador
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Client selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <UserCircle className="h-4 w-4" />
                  Cliente
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  required
                >
                  <option value="">Selecciona un cliente</option>
                  {clientsData?.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName
                        ? `${c.companyName} (${c.user.name})`
                        : c.user.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de servicio</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedServiceId}
                  onChange={(e) => {
                    setSelectedServiceId(e.target.value);
                    setFormData({});
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
                      Tiempo estimado: {selectedService.estimatedHours} hrs.
                    </p>
                    <p className="text-xs text-muted-foreground/80 flex items-start gap-1 pl-0.5">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      Los tiempos son aproximados y pueden variar según el tipo de tarea o ajustes por parte de los clientes.
                    </p>
                  </div>
                )}
              </div>

              {/* Collaborators (optional, multi-select) */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Asignar colaboradores
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>

                {/* AI Suggested assignees */}
                {aiAssignment?.suggestions && aiAssignment.suggestions.length > 0 && selectedAssignees.length === 0 && (
                  <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-2">
                    <p className="text-xs font-medium text-violet-700 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Sugeridos por IA
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {aiAssignment.suggestions.map((s) => (
                        <button
                          key={s.colaboradorId}
                          type="button"
                          onClick={() => handleAddAssignee(s.colaboradorId)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1 text-xs hover:bg-violet-100 transition-colors"
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{s.reasons[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected assignees */}
                {selectedAssignees.length > 0 && (
                  <div className="space-y-1">
                    {selectedAssignees.map((a, i) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{a.name}</span>
                          {i === 0 ? (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              <Star className="h-3 w-3 mr-0.5" />
                              Principal
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Ayudante</Badge>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignee(a.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add assignee dropdown */}
                <div className="flex gap-2">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value=""
                    onChange={(e) => {
                      handleAddAssignee(e.target.value);
                      e.target.value = "";
                    }}
                  >
                    <option value="">{selectedAssignees.length === 0 ? "Auto-asignar (o seleccionar)" : "Agregar colaborador..."}</option>
                    {(session?.user as any)?.id && !selectedAssignees.some((a) => a.id === `user:${(session?.user as any).id}`) && (
                      <option value={`user:${(session?.user as any).id}`}>
                        ★ Asignarme a mí ({session?.user?.name ?? "Yo"})
                      </option>
                    )}
                    {colaboradores
                      .filter((c) => !selectedAssignees.some((a) => a.id === c.colaboradorProfile!.id))
                      .map((c) => (
                        <option key={c.colaboradorProfile!.id} value={c.colaboradorProfile!.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  El primero seleccionado será el encargado principal. Si no se selecciona ninguno, se auto-asigna.
                </p>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  Categoría
                  {aiCategory?.category && aiCategory.confidence === "high" && !userOverrodeCategory && (
                    <span className="inline-flex items-center gap-1 text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                      <Sparkles className="h-3 w-3" />
                      Sugerido por IA
                    </span>
                  )}
                </label>
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
                <label className="text-sm font-medium">Título de la tarea</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Rediseño de la página de inicio"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Descripción</label>
                  {selectedServiceId && (
                    <button
                      type="button"
                      onClick={triggerDescSuggest}
                      disabled={!selectedServiceId || loadingAI}
                      className="inline-flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {loadingAI ? "Generando..." : "Sugerir con IA"}
                    </button>
                  )}
                </div>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe los detalles de la tarea..."
                />
                {aiSuggestion && (
                  <div className="bg-muted rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-violet-700 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Sugerencia de IA
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{aiSuggestion}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDescription(aiSuggestion);
                          setAiSuggestion("");
                          setDescSuggestInput(null);
                        }}
                        className="text-xs bg-violet-600 text-white px-3 py-1 rounded-md hover:bg-violet-700 transition-colors"
                      >
                        Usar esta descripción
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAiSuggestion("");
                          setDescSuggestInput(null);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                )}
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
                  <span className="text-muted-foreground/60">— por qué se está creando (opcional)</span>
                </button>
              ) : (
                <div className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium flex items-center gap-1.5">
                      <MessageSquareText className="h-3 w-3" />
                      ¿Por qué se está creando esta tarea?
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
                    placeholder="Ej: El cliente lanza producto el viernes y necesita esto antes…"
                    maxLength={1000}
                  />
                  <p className="text-[10px] text-muted-foreground/70">
                    Este contexto ayuda a priorizar mejor y entender qué es importante para el cliente.
                  </p>
                </div>
              )}

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
                  {createMutation.isLoading ? "Creando..." : "Crear Tarea"}
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

        {/* AI Chat Panel */}
        {showAIChat && selectedServiceId && (
          <div className="hidden lg:block">
            <Card className="sticky top-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4 text-violet-500" />
                  Asistente IA
                </CardTitle>
                <CardDescription className="text-xs">
                  Describe la tarea y el asistente te ayudará a completar el formulario
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ChatPanel
                  serviceId={selectedServiceId}
                  serviceName={selectedService?.name ?? ""}
                  formData={formData}
                  onFieldsUpdate={handleAIFieldsUpdate}
                />
              </CardContent>
            </Card>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
