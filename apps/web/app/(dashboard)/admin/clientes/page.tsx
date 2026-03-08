"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Plus, Search, Mail, Phone, Building2, ListTodo, UserPlus, X, ShieldCheck, CreditCard, Pencil, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema } from "@isytask/shared";
import { z } from "zod";

type CreateForm = z.infer<typeof createUserSchema>;

export default function ClientesPage() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();
  const { data: clientsData, isLoading } = trpc.clients.list.useQuery({
    search: search || undefined,
  });

  // Get all active services for the service access checklist
  const { data: allServices } = trpc.services.list.useQuery();

  // Get team members for the collaborator selector
  const { data: teamData } = trpc.users.list.useQuery({
    role: "COLABORADOR",
    page: 1,
    pageSize: 50,
  });

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      setShowForm(false);
      reset();
    },
  });

  const assignMutation = trpc.clients.assignColaborador.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
    },
  });

  const removeMutation = trpc.clients.removeColaborador.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
    },
  });

  const addServiceAccessMutation = trpc.clients.addServiceAccess.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
    },
  });

  const removeServiceAccessMutation = trpc.clients.removeServiceAccess.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
    },
  });

  const updateLimitsMutation = trpc.clients.updateLimits.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      setEditingPlan(null);
    },
  });

  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ planName: "", planDescription: "", monthlyTaskLimit: 10, revisionLimitPerTask: 3 });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "CLIENTE" },
  });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate(data);
  };

  const colaboradores = teamData?.users.filter((u) => u.colaboradorProfile) ?? [];

  return (
    <>
      <Topbar title="Clientes" />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Cliente
          </Button>
        </div>

        {/* Create form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nuevo Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <input type="hidden" {...register("role")} value="CLIENTE" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nombre del contacto</label>
                    <Input {...register("name")} placeholder="Nombre completo" />
                    {errors.name && (
                      <p className="text-xs text-destructive">{errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input {...register("email")} type="email" placeholder="email@empresa.com" />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Contraseña</label>
                    <Input {...register("password")} type="password" placeholder="Min. 6 caracteres" />
                    {errors.password && (
                      <p className="text-xs text-destructive">{errors.password.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Teléfono (WhatsApp)</label>
                    <Input {...register("phone")} placeholder="+52 1234567890" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isLoading}>
                    {createMutation.isLoading ? "Creando..." : "Crear Cliente"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); reset(); }}>
                    Cancelar
                  </Button>
                </div>
                {createMutation.error && (
                  <p className="text-sm text-destructive">{createMutation.error.message}</p>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        {/* Clients list */}
        {isLoading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientsData?.clients.map((client) => {
              const assignedIds = client.assignedColaboradors.map(
                (a) => a.colaborador.id
              );
              const availableColabs = colaboradores.filter(
                (c) => !assignedIds.includes(c.colaboradorProfile!.id)
              );

              return (
                <Card key={client.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        {client.companyName && (
                          <p className="font-semibold flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            {client.companyName}
                          </p>
                        )}
                        <h3 className={client.companyName ? "text-sm text-muted-foreground" : "font-semibold"}>
                          {client.user.name}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {client.user.email}
                        </p>
                        {client.user.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {client.user.phone}
                          </p>
                        )}
                      </div>
                      <Badge variant={client.user.isActive ? "default" : "secondary"}>
                        {client.user.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <ListTodo className="h-3 w-3" />
                        {client._count.tasks} tareas
                      </span>
                      <span className="text-muted-foreground">
                        Límite: {client.monthlyTaskLimit}/mes
                      </span>
                    </div>

                    {/* Plan & Limits */}
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          Plan y Límites
                        </p>
                        {editingPlan !== client.id ? (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditingPlan(client.id);
                              setPlanForm({
                                planName: (client as any).planName ?? "Básico",
                                planDescription: (client as any).planDescription ?? "",
                                monthlyTaskLimit: client.monthlyTaskLimit,
                                revisionLimitPerTask: client.revisionLimitPerTask,
                              });
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="text-xs text-primary hover:text-primary/80"
                              onClick={() => {
                                updateLimitsMutation.mutate({
                                  id: client.id,
                                  ...planForm,
                                  planDescription: planForm.planDescription || null,
                                });
                              }}
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => setEditingPlan(null)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      {editingPlan === client.id ? (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Nombre del plan</label>
                            <Input
                              className="h-7 text-xs"
                              value={planForm.planName}
                              onChange={(e) => setPlanForm((p) => ({ ...p, planName: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Descripción</label>
                            <Input
                              className="h-7 text-xs"
                              value={planForm.planDescription}
                              onChange={(e) => setPlanForm((p) => ({ ...p, planDescription: e.target.value }))}
                              placeholder="Opcional..."
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground">Tareas/mes</label>
                              <Input
                                type="number"
                                className="h-7 text-xs"
                                value={planForm.monthlyTaskLimit}
                                onChange={(e) => setPlanForm((p) => ({ ...p, monthlyTaskLimit: Number(e.target.value) }))}
                                min={1}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Revisiones/tarea</label>
                              <Input
                                type="number"
                                className="h-7 text-xs"
                                value={planForm.revisionLimitPerTask}
                                onChange={(e) => setPlanForm((p) => ({ ...p, revisionLimitPerTask: Number(e.target.value) }))}
                                min={0}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {(client as any).planName ?? "Básico"}
                            </Badge>
                            {(client as any).planDescription && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                {(client as any).planDescription}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {client.monthlyTaskLimit} tareas/mes · {client.revisionLimitPerTask} revisiones/tarea
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Collaborator assignments */}
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <UserPlus className="h-3 w-3" />
                        Colaboradores asignados
                      </p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {client.assignedColaboradors.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">
                            Sin colaboradores asignados
                          </span>
                        )}
                        {client.assignedColaboradors.map((a) => (
                          <Badge
                            key={a.colaborador.id}
                            variant="outline"
                            className="text-xs pr-1 flex items-center gap-1"
                          >
                            {a.colaborador.user.name}
                            <button
                              type="button"
                              className="ml-1 hover:text-destructive"
                              onClick={() => {
                                removeMutation.mutate({
                                  clientId: client.id,
                                  colaboradorId: a.colaborador.id,
                                });
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      {availableColabs.length > 0 && (
                        <select
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            assignMutation.mutate({
                              clientId: client.id,
                              colaboradorId: e.target.value,
                            });
                          }}
                        >
                          <option value="">+ Agregar colaborador...</option>
                          {availableColabs.map((c) => (
                            <option
                              key={c.colaboradorProfile!.id}
                              value={c.colaboradorProfile!.id}
                            >
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    {/* Service access checklist */}
                    {allServices && allServices.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Servicios permitidos
                        </p>
                        {client.allowedServices.length === 0 && (
                          <p className="text-xs text-muted-foreground italic mb-2">
                            Sin restricciones (acceso a todos)
                          </p>
                        )}
                        <div className="space-y-1">
                          {allServices.map((svc) => {
                            const hasAccess = client.allowedServices.some(
                              (a: { serviceId: string }) => a.serviceId === svc.id
                            );
                            return (
                              <label
                                key={svc.id}
                                className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5"
                              >
                                <input
                                  type="checkbox"
                                  checked={hasAccess}
                                  className="rounded border-input h-3.5 w-3.5 accent-primary"
                                  onChange={() => {
                                    if (hasAccess) {
                                      removeServiceAccessMutation.mutate({
                                        clientId: client.id,
                                        serviceId: svc.id,
                                      });
                                    } else {
                                      addServiceAccessMutation.mutate({
                                        clientId: client.id,
                                        serviceId: svc.id,
                                      });
                                    }
                                  }}
                                />
                                <span>{svc.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {clientsData?.clients.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">
                No hay clientes registrados
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
