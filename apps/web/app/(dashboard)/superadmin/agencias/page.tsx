"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  Plus,
  Search,
  Users,
  ListTodo,
  Briefcase,
  Building2,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAgencySchema } from "@isytask/shared";
import type { z } from "zod";
import { CardListSkeleton } from "@/components/ui/skeleton";
import Link from "next/link";

type CreateForm = z.infer<typeof createAgencySchema>;

export default function AgenciasPage() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.agencies.list.useQuery({
    search: search || undefined,
  });

  const createMutation = trpc.agencies.create.useMutation({
    onSuccess: () => {
      utils.agencies.list.invalidate();
      setShowForm(false);
      reset();
    },
  });

  const toggleMutation = trpc.agencies.toggleActive.useMutation({
    onSuccess: () => {
      utils.agencies.list.invalidate();
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createAgencySchema),
    defaultValues: {
      planTier: "basic",
      maxUsers: 50,
    },
  });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate(data);
  };

  return (
    <>
      <Topbar title="Gestión de Agencias" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Header: Search + Create */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar agencias..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Agencia
          </Button>
        </div>

        {/* Create form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Crear nueva agencia</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Agency info */}
                  <div>
                    <label className="text-sm font-medium">Nombre de la agencia *</label>
                    <Input {...register("name")} placeholder="Mi Agencia" />
                    {errors.name && (
                      <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Slug (URL) *</label>
                    <Input {...register("slug")} placeholder="mi-agencia" />
                    {errors.slug && (
                      <p className="text-xs text-destructive mt-1">{errors.slug.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Plan</label>
                    <select
                      {...register("planTier")}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="basic">Básico</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Máx. usuarios</label>
                    <Input
                      type="number"
                      {...register("maxUsers", { valueAsNumber: true })}
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email de facturación</label>
                    <Input {...register("billingEmail")} placeholder="billing@agencia.com" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Logo URL</label>
                    <Input {...register("logoUrl")} placeholder="https://..." />
                  </div>

                  {/* Admin user */}
                  <div className="md:col-span-2">
                    <div className="border-t pt-4 mt-2">
                      <p className="text-sm font-medium text-muted-foreground mb-3">
                        Primer administrador de la agencia
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Nombre del admin *</label>
                    <Input {...register("adminName")} placeholder="Juan Pérez" />
                    {errors.adminName && (
                      <p className="text-xs text-destructive mt-1">{errors.adminName.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email del admin *</label>
                    <Input {...register("adminEmail")} placeholder="admin@agencia.com" />
                    {errors.adminEmail && (
                      <p className="text-xs text-destructive mt-1">{errors.adminEmail.message}</p>
                    )}
                  </div>
                </div>

                {createMutation.error && (
                  <p className="text-sm text-destructive">
                    {createMutation.error.message}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Crear Agencia
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      reset();
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Agency list */}
        {isLoading ? (
          <CardListSkeleton cards={3} />
        ) : data?.agencies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                {search ? "No se encontraron agencias" : "No hay agencias todavía"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.agencies.map((agency) => (
              <Card key={agency.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <Link
                        href={`/superadmin/agencias/${agency.id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {agency.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{agency.slug}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={agency.isActive ? "default" : "secondary"}>
                        {agency.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {agency.planTier}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {agency._count.users} usuarios
                    </span>
                    <span className="flex items-center gap-1">
                      <ListTodo className="h-3.5 w-3.5" /> {agency._count.tasks} tareas
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" /> {agency._count.services} servicios
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/superadmin/agencias/${agency.id}`}>
                      <Button variant="outline" size="sm">
                        Ver detalle
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toggleMutation.mutate({
                          id: agency.id,
                          isActive: !agency.isActive,
                        })
                      }
                      disabled={toggleMutation.isPending}
                      className={agency.isActive ? "text-orange-600" : "text-green-600"}
                    >
                      {agency.isActive ? (
                        <>
                          <ToggleRight className="h-4 w-4 mr-1" /> Desactivar
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-4 w-4 mr-1" /> Activar
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination info */}
        {data && data.totalPages > 1 && (
          <p className="text-sm text-muted-foreground text-center">
            Mostrando {data.agencies.length} de {data.total} agencias
          </p>
        )}
      </div>
    </>
  );
}
