"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { SortableFieldItem } from "@/components/forms/sortable-field-item";
import { FieldFormModal } from "@/components/forms/field-form-modal";
import { ArrowLeft, Plus, Clock, FileText, Bot, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function CamposPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params.id as string;

  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // AI Agent state
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [agentInstructions, setAgentInstructions] = useState("");
  const [agentModel, setAgentModel] = useState("");
  const [agentLoaded, setAgentLoaded] = useState(false);

  const utils = trpc.useUtils();
  const { data: service } = trpc.services.getById.useQuery({ id: serviceId });
  const { data: fields } = trpc.services.getFormFields.useQuery({ serviceId });

  // Load agent config from service data
  useEffect(() => {
    if (service && !agentLoaded) {
      setAgentEnabled(service.agentEnabled ?? false);
      setAgentInstructions(service.agentInstructions ?? "");
      setAgentModel(service.agentModel ?? "");
      setAgentLoaded(true);
    }
  }, [service, agentLoaded]);

  const updateServiceMutation = trpc.services.update.useMutation({
    onSuccess: () => {
      utils.services.getById.invalidate({ id: serviceId });
    },
  });

  const addField = trpc.services.addFormField.useMutation({
    onSuccess: () => {
      utils.services.getFormFields.invalidate({ serviceId });
      setShowModal(false);
      setEditingField(null);
    },
  });

  const updateField = trpc.services.updateFormField.useMutation({
    onSuccess: () => {
      utils.services.getFormFields.invalidate({ serviceId });
      setShowModal(false);
      setEditingField(null);
    },
  });

  const removeField = trpc.services.removeFormField.useMutation({
    onSuccess: () => {
      utils.services.getFormFields.invalidate({ serviceId });
    },
  });

  const reorderFields = trpc.services.reorderFields.useMutation({
    onSuccess: () => {
      utils.services.getFormFields.invalidate({ serviceId });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !fields) return;

      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);
      const newOrder = arrayMove(fields, oldIndex, newIndex);

      reorderFields.mutate({
        fields: newOrder.map((f, i) => ({ id: f.id, sortOrder: i })),
      });
    },
    [fields, reorderFields]
  );

  const handleSave = (data: any) => {
    if (data.id) {
      // Edit existing
      const cleanValidation =
        data.validation && Object.keys(data.validation).length > 0
          ? data.validation
          : undefined;

      updateField.mutate({
        id: data.id,
        label: data.label,
        fieldType: data.fieldType,
        placeholder: data.placeholder || undefined,
        isRequired: data.isRequired,
        options: data.options.length > 0 ? data.options : undefined,
        validation: cleanValidation,
      });
    } else {
      // Add new
      const nextOrder = fields ? fields.length : 0;
      const cleanValidation =
        data.validation && Object.keys(data.validation).length > 0
          ? data.validation
          : undefined;

      addField.mutate({
        serviceId,
        fieldName: data.fieldName,
        label: data.label,
        fieldType: data.fieldType,
        placeholder: data.placeholder || undefined,
        isRequired: data.isRequired,
        sortOrder: nextOrder,
        options: data.options.length > 0 ? data.options : undefined,
        validation: cleanValidation,
      });
    }
  };

  const handleEdit = (field: any) => {
    setEditingField({
      id: field.id,
      fieldName: field.fieldName,
      label: field.label,
      fieldType: field.fieldType,
      placeholder: field.placeholder ?? "",
      isRequired: field.isRequired,
      options: (field.options as string[]) ?? [],
      validation: (field.validation as any) ?? {},
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de eliminar este campo?")) {
      removeField.mutate({ id });
    }
  };

  return (
    <>
      <Topbar title="Configurar Campos" />
      <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
        {/* Back + Service info */}
        <div className="flex items-center gap-4">
          <Link href="/admin/servicios">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-xl font-bold">{service?.name ?? "..."}</h2>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {service?.estimatedHours} hrs estimadas
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {fields?.length ?? 0} campos
              </span>
            </div>
          </div>
        </div>

        {/* AI Agent Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Agente IA</CardTitle>
                <CardDescription>
                  Configura un asistente de IA que guíe al cliente al crear tareas para este servicio
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between p-3 rounded-md border cursor-pointer hover:bg-muted/50">
              <div>
                <p className="text-sm font-medium">Habilitar agente IA para este servicio</p>
                <p className="text-xs text-muted-foreground">
                  Los clientes verán un chat interactivo al crear una tarea de este servicio
                </p>
              </div>
              <input
                type="checkbox"
                checked={agentEnabled}
                onChange={(e) => setAgentEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </label>

            {agentEnabled && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Instrucciones del agente</label>
                  <textarea
                    value={agentInstructions}
                    onChange={(e) => setAgentInstructions(e.target.value)}
                    rows={5}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={`Ejemplo: Eres un consultor de diseño. Pregunta al cliente sobre:\n- Nombre de la empresa y a qué se dedica\n- Colores preferidos o paleta de marca\n- Estilo deseado (moderno, clásico, minimalista)\n- Referencias de diseño que le gusten`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Instrucciones que guían al agente sobre qué preguntar y cómo asistir al cliente.
                    El agente también conocerá automáticamente los campos del formulario.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Modelo (opcional)</label>
                  <Input
                    value={agentModel}
                    onChange={(e) => setAgentModel(e.target.value)}
                    placeholder="Dejar vacío para usar el modelo global"
                  />
                  <p className="text-xs text-muted-foreground">
                    Sobrescribe el modelo por defecto para este servicio. Ej: openai/gpt-4o, anthropic/claude-3.5-sonnet
                  </p>
                </div>
              </>
            )}

            <Button
              size="sm"
              onClick={() => {
                updateServiceMutation.mutate({
                  id: serviceId,
                  agentEnabled,
                  agentInstructions: agentInstructions || null,
                  agentModel: agentModel || null,
                });
              }}
              disabled={updateServiceMutation.isLoading}
            >
              {updateServiceMutation.isLoading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1" />
              )}
              Guardar configuración IA
            </Button>

            {updateServiceMutation.isSuccess && (
              <p className="text-xs text-green-600">Configuración del agente guardada</p>
            )}
          </CardContent>
        </Card>

        {/* Fields list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Campos del Formulario
            </CardTitle>
            <Button
              onClick={() => {
                setEditingField(null);
                setShowModal(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Campo
            </Button>
          </CardHeader>
          <CardContent>
            {fields && fields.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <SortableFieldItem
                        key={field.id}
                        field={field}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        isExpanded={expandedId === field.id}
                        onToggleExpand={() =>
                          setExpandedId(
                            expandedId === field.id ? null : field.id
                          )
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No hay campos configurados</p>
                <p className="text-sm">
                  Agrega campos para que los clientes completen al solicitar
                  este servicio
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview hint */}
        {fields && fields.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Arrastra los campos para reordenarlos. Los clientes verán estos
            campos al solicitar este servicio.
          </p>
        )}
      </div>

      {/* Modal */}
      <FieldFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingField(null);
        }}
        onSave={handleSave}
        initialData={editingField}
        isLoading={addField.isLoading || updateField.isLoading}
      />
    </>
  );
}
