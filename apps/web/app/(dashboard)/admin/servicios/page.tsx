"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Plus, Clock, FileText, Settings, Shield } from "lucide-react";
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

export default function ServiciosPage() {
  const [showForm, setShowForm] = useState(false);
  const utils = trpc.useUtils();
  const { data: services, isLoading } = trpc.services.list.useQuery();

  const createMutation = trpc.services.create.useMutation({
    onSuccess: () => {
      utils.services.list.invalidate();
      setShowForm(false);
      reset();
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

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({
      ...data,
      slaHours: data.slaHours || null,
    });
  };

  return (
    <>
      <Topbar title="Servicios" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Administra los servicios y sus formularios personalizados
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
                  <div className="mt-3">
                    <Link href={`/admin/servicios/${service.id}/campos`}>
                      <Button variant="outline" size="sm">
                        <Settings className="h-3 w-3 mr-1" />
                        Configurar Campos
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
            {services?.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">
                No hay servicios registrados
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
