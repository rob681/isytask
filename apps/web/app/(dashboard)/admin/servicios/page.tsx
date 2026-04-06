"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Plus, Clock, FileText, Settings, Shield, Pencil, X, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createServiceSchema } from "@isytask/shared";
import { z } from "zod";
import Link from "next/link";
import { CardListSkeleton } from "@/components/ui/skeleton";

const createFormSchema = createServiceSchema.extend({
  slaHours: z.number().int().min(1).optional().nullable(),
});

type CreateForm = z.infer<typeof createFormSchema>;

const editFormSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional().nullable(),
  estimatedHours: z.number().int().min(1, "Mínimo 1 hora"),
  slaHours: z.number().int().min(1).optional().nullable(),
});

type EditForm = z.infer<typeof editFormSchema>;

export default function ServiciosPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const { data: services, isLoading } = trpc.services.list.useQuery();

  const createMutation = trpc.services.create.useMutation({
    onSuccess: () => {
      utils.services.list.invalidate();
      setShowForm(false);
      reset();
    },
  });

  const updateMutation = trpc.services.update.useMutation({
    onSuccess: () => {
      utils.services.list.invalidate();
      setEditingId(null);
      editReset();
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createFormSchema),
  });

  const {
    register: editRegister,
    handleSubmit: editHandleSubmit,
    reset: editReset,
    formState: { errors: editErrors },
  } = useForm<EditForm>({
    resolver: zodResolver(editFormSchema),
  });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({
      ...data,
      slaHours: data.slaHours || null,
    });
  };

  const startEditing = (service: any) => {
    setEditingId(service.id);
    editReset({
      name: service.name,
      description: service.description || "",
      estimatedHours: service.estimatedHours,
      slaHours: service.slaHours || null,
    });
  };

  const onEditSubmit = (data: EditForm) => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      name: data.name,
      description: data.description ?? undefined,
      estimatedHours: data.estimatedHours,
      slaHours: data.slaHours || null,
    });
  };

  return (
    <>
      <Topbar title="Servicios" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Los servicios definen los tipos de trabajo que ofreces. Cada servicio incluye un formulario personalizado que tus clientes llenan al crear una tarea.
          </p>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Servicio
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nuevo Servicio</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nombre del servicio</label>
                    <Input {...register("name")} placeholder="Ej: Diseño de página web" />
                    {errors.name && (
                      <p className="text-xs text-destructive">{errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Horas estimadas</label>
                    <Input
                      {...register("estimatedHours", { valueAsNumber: true })}
                      type="number"
                      placeholder="Ej: 120"
                    />
                    {errors.estimatedHours && (
                      <p className="text-xs text-destructive">{errors.estimatedHours.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Descripción</label>
                    <Input {...register("description")} placeholder="Descripción breve" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">SLA (horas máximas)</label>
                    <Input
                      {...register("slaHours", { valueAsNumber: true })}
                      type="number"
                      placeholder="Ej: 48 (opcional)"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Tiempo máximo para resolver. Dejar vacío para sin SLA.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isLoading}>
                    {createMutation.isLoading ? "Creando..." : "Crear Servicio"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); reset(); }}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <CardListSkeleton cards={4} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services?.map((service) => (
              <Card key={service.id}>
                <CardContent className="p-4">
                  {editingId === service.id ? (
                    <form onSubmit={editHandleSubmit(onEditSubmit)} className="space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-muted-foreground">Editando servicio</span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Nombre</label>
                        <Input {...editRegister("name")} placeholder="Nombre del servicio" />
                        {editErrors.name && <p className="text-xs text-destructive">{editErrors.name.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Descripción</label>
                        <Input {...editRegister("description")} placeholder="Descripción" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Horas estimadas</label>
                          <Input {...editRegister("estimatedHours", { valueAsNumber: true })} type="number" />
                          {editErrors.estimatedHours && <p className="text-xs text-destructive">{editErrors.estimatedHours.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">SLA (horas)</label>
                          <Input {...editRegister("slaHours", { valueAsNumber: true })} type="number" placeholder="Opcional" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={updateMutation.isLoading}>
                          <Check className="h-3 w-3 mr-1" />
                          {updateMutation.isLoading ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{service.name}</h3>
                          {service.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {service.description}
                            </p>
                          )}
                        </div>
                        <Badge variant={service.isActive ? "default" : "secondary"}>
                          {service.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {service.estimatedHours} hrs
                        </span>
                        {(service as any).slaHours && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Shield className="h-3 w-3" />
                            SLA: {(service as any).slaHours}h
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {service._count.formFields} campos
                        </span>
                        <span className="flex items-center gap-1">
                          {service._count.tasks} tareas
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => startEditing(service)}>
                          <Pencil className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Link href={`/admin/servicios/${service.id}/campos`}>
                          <Button variant="outline" size="sm">
                            <Settings className="h-3 w-3 mr-1" />
                            Configurar Campos
                          </Button>
                        </Link>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
            {services?.length === 0 && (
              <div className="col-span-full text-center py-8 space-y-2">
                <p className="text-muted-foreground">No hay servicios registrados</p>
                <p className="text-muted-foreground/60 text-sm max-w-md mx-auto">
                  Crea tu primer servicio para que los clientes puedan enviar solicitudes. Define los campos que necesitas en cada formulario.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
