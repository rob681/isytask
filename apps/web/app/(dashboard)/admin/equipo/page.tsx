"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Plus, Search, Mail, Phone, Shield, Check, RefreshCw, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserSchema,
  PERMISSION_LABELS,
  PERMISSION_DESCRIPTIONS,
  ALL_PERMISSIONS,
} from "@isytask/shared";
import type { Permission } from "@isytask/shared";
import { z } from "zod";

type CreateForm = z.infer<typeof createUserSchema>;

export default function EquipoPage() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [editingPermissions, setEditingPermissions] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.users.list.useQuery({
    role: "COLABORADOR",
    search: search || undefined,
  });

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setShowForm(false);
      reset();
    },
  });

  const permissionsMutation = trpc.users.updatePermissions.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
    },
  });

  const resendMutation = trpc.users.resendInvitation.useMutation({
    onSuccess: () => {
      alert("Invitación reenviada exitosamente");
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "COLABORADOR" },
  });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate(data);
  };

  const togglePermission = (profileId: string, currentPerms: string[], perm: Permission) => {
    const newPerms = currentPerms.includes(perm)
      ? currentPerms.filter((p) => p !== perm)
      : [...currentPerms, perm];
    permissionsMutation.mutate({
      colaboradorProfileId: profileId,
      permissions: newPerms as Permission[],
    });
  };

  return (
    <>
      <Topbar title="Equipo de Trabajo" />
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
            Nuevo Miembro
          </Button>
        </div>

        {/* Create form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nuevo Miembro del Equipo</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <input type="hidden" {...register("role")} value="COLABORADOR" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nombre</label>
                    <Input {...register("name")} placeholder="Nombre completo" />
                    {errors.name && (
                      <p className="text-xs text-destructive">{errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input {...register("email")} type="email" placeholder="email@ejemplo.com" />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Teléfono (WhatsApp)</label>
                    <Input {...register("phone")} placeholder="+52 1234567890" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isLoading}>
                    {createMutation.isLoading ? "Creando..." : "Invitar Miembro"}
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

        {/* Team list */}
        {isLoading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data?.users.map((user) => {
              const profile = user.colaboradorProfile;
              const currentPerms = (profile?.permissions as string[]) ?? [];
              const isEditing = editingPermissions === user.id;

              return (
                <Card key={user.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{user.name}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Mail className="h-3 w-3" /> {user.email}
                        </p>
                        {user.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {user.phone}
                          </p>
                        )}
                        {profile?.specialty && (
                          <p className="text-sm mt-2">
                            Especialidad: {profile.specialty}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!user.hasPassword && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Pendiente
                          </Badge>
                        )}
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    </div>

                    {/* Resend invitation */}
                    {!user.hasPassword && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={resendMutation.isLoading}
                          onClick={() => resendMutation.mutate({ userId: user.id })}
                        >
                          <RefreshCw className={`h-3 w-3 mr-1 ${resendMutation.isLoading ? "animate-spin" : ""}`} />
                          Reenviar invitación
                        </Button>
                      </div>
                    )}

                    {/* Permissions section */}
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Permisos de administración
                        </p>
                        <Button
                          size="sm"
                          variant={isEditing ? "default" : "ghost"}
                          className="h-6 text-xs"
                          onClick={() =>
                            setEditingPermissions(isEditing ? null : user.id)
                          }
                        >
                          {isEditing ? "Listo" : "Editar"}
                        </Button>
                      </div>

                      {/* Current permissions badges */}
                      {!isEditing && (
                        <div className="flex flex-wrap gap-1">
                          {currentPerms.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">
                              Sin permisos adicionales
                            </span>
                          ) : (
                            currentPerms.map((perm) => (
                              <Badge
                                key={perm}
                                variant="outline"
                                className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                              >
                                {PERMISSION_LABELS[perm as Permission] ?? perm}
                              </Badge>
                            ))
                          )}
                        </div>
                      )}

                      {/* Permission editor */}
                      {isEditing && profile && (
                        <div className="space-y-2">
                          {ALL_PERMISSIONS.map((perm) => {
                            const isActive = currentPerms.includes(perm);
                            return (
                              <button
                                key={perm}
                                type="button"
                                className={`w-full flex items-start gap-3 p-2 rounded-md border text-left transition-colors ${
                                  isActive
                                    ? "border-amber-300 bg-amber-50"
                                    : "border-border hover:bg-muted/50"
                                }`}
                                onClick={() =>
                                  togglePermission(profile.id, currentPerms, perm)
                                }
                                disabled={permissionsMutation.isLoading}
                              >
                                <div
                                  className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                                    isActive
                                      ? "bg-amber-500 border-amber-500 text-white"
                                      : "border-muted-foreground/30"
                                  }`}
                                >
                                  {isActive && <Check className="h-3 w-3" />}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">
                                    {PERMISSION_LABELS[perm]}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {PERMISSION_DESCRIPTIONS[perm]}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {data?.users.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">
                No hay miembros del equipo registrados
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
