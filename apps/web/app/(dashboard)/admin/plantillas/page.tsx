"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import { TASK_CATEGORY_LABELS, TASK_CATEGORY_BADGE_COLORS } from "@isytask/shared";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  Briefcase,
  GripVertical,
  Power,
  PowerOff,
} from "lucide-react";

export default function PlantillasPage() {
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterServiceId, setFilterServiceId] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [category, setCategory] = useState<"URGENTE" | "NORMAL" | "LARGO_PLAZO">("NORMAL");

  const { data: templates, isLoading } = trpc.templates.list.useQuery({
    activeOnly: false,
    serviceId: filterServiceId || undefined,
  });
  const { data: services } = trpc.services.list.useQuery();

  const createMutation = trpc.templates.create.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      resetForm();
    },
  });

  const updateMutation = trpc.templates.update.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      resetForm();
    },
  });

  const deleteMutation = trpc.templates.delete.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
    },
  });

  const toggleActiveMutation = trpc.templates.update.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setDescription("");
    setServiceId("");
    setCategory("NORMAL");
  };

  const startEdit = (template: any) => {
    setEditingId(template.id);
    setName(template.name);
    setDescription(template.description ?? "");
    setServiceId(template.serviceId);
    setCategory(template.category);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !serviceId) return;

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name,
        description: description || null,
        serviceId,
        category,
      });
    } else {
      createMutation.mutate({
        name,
        description: description || undefined,
        serviceId,
        category,
      });
    }
  };

  const filtered = templates?.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  return (
    <>
      <Topbar title="Plantillas de Tareas" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Define plantillas predefinidas para agilizar la creación de tareas por parte de los clientes.
          </p>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva Plantilla
          </Button>
        </div>

        {/* Create/Edit Form */}
        {showForm && (
          <Card className="border-primary/40">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {editingId ? "Editar Plantilla" : "Nueva Plantilla"}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nombre *</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej: Diseño de logo básico"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Servicio *</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={serviceId}
                      onChange={(e) => setServiceId(e.target.value)}
                      required
                    >
                      <option value="">Selecciona un servicio</option>
                      {services?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Descripción</label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descripción de la plantilla..."
                  />
                </div>

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

                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                </div>

                {(createMutation.error || updateMutation.error) && (
                  <p className="text-sm text-destructive">
                    {createMutation.error?.message || updateMutation.error?.message}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar plantillas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={filterServiceId}
            onChange={(e) => setFilterServiceId(e.target.value)}
          >
            <option value="">Todos los servicios</option>
            {services?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Templates list */}
        {isLoading ? (
          <p className="text-muted-foreground text-center py-12">Cargando plantillas...</p>
        ) : filtered?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">
                No hay plantillas definidas aún.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Crea plantillas para que los clientes puedan crear tareas más rápido.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered?.map((template) => (
              <Card
                key={template.id}
                className={`transition-colors ${!template.isActive ? "opacity-60" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{template.name}</h3>
                        <Badge className={TASK_CATEGORY_BADGE_COLORS[template.category]}>
                          {TASK_CATEGORY_LABELS[template.category]}
                        </Badge>
                        {!template.isActive && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactiva
                          </Badge>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Briefcase className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {template.service.name}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          toggleActiveMutation.mutate({
                            id: template.id,
                            isActive: !template.isActive,
                          });
                        }}
                        title={template.isActive ? "Desactivar" : "Activar"}
                      >
                        {template.isActive ? (
                          <Power className="h-4 w-4 text-green-500" />
                        ) : (
                          <PowerOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => startEdit(template)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("¿Desactivar esta plantilla?")) {
                            deleteMutation.mutate({ id: template.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary */}
        {templates && templates.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {templates.filter((t) => t.isActive).length} activas de {templates.length} plantillas totales
          </p>
        )}
      </div>
    </>
  );
}
