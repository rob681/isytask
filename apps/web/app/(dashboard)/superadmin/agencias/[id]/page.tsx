"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  ArrowLeft,
  Users,
  ListTodo,
  Briefcase,
  Save,
  Loader2,
  Mail,
  ToggleLeft,
  ToggleRight,
  Check,
  X,
} from "lucide-react";
import Link from "next/link";
import { CardListSkeleton } from "@/components/ui/skeleton";

export default function AgenciaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    logoUrl: "",
    planTier: "basic",
    maxUsers: 50,
    billingEmail: "",
  });

  const utils = trpc.useUtils();
  const { data: agency, isLoading } = trpc.agencies.getById.useQuery(
    { id },
    {
      onSuccess: (data) => {
        setFormData({
          name: data.name,
          slug: data.slug,
          logoUrl: data.logoUrl || "",
          planTier: data.planTier,
          maxUsers: data.maxUsers,
          billingEmail: data.billingEmail || "",
        });
      },
    }
  );

  const updateMutation = trpc.agencies.update.useMutation({
    onSuccess: () => {
      utils.agencies.getById.invalidate({ id });
      utils.agencies.list.invalidate();
      setIsEditing(false);
    },
  });

  const toggleMutation = trpc.agencies.toggleActive.useMutation({
    onSuccess: () => {
      utils.agencies.getById.invalidate({ id });
      utils.agencies.list.invalidate();
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      id,
      name: formData.name,
      slug: formData.slug,
      logoUrl: formData.logoUrl || null,
      planTier: formData.planTier,
      maxUsers: formData.maxUsers,
      billingEmail: formData.billingEmail || null,
    });
  };

  if (isLoading) {
    return (
      <>
        <Topbar title="Detalle de agencia" />
        <div className="p-4 md:p-6">
          <CardListSkeleton cards={2} />
        </div>
      </>
    );
  }

  if (!agency) {
    return (
      <>
        <Topbar title="Agencia no encontrada" />
        <div className="p-4 md:p-6 text-center">
          <p className="text-muted-foreground">La agencia no existe.</p>
          <Link href="/superadmin/agencias">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver
            </Button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title={agency.name} />
      <div className="p-4 md:p-6 space-y-6">
        {/* Back button */}
        <Link href="/superadmin/agencias">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver a agencias
          </Button>
        </Link>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{agency._count.users}</p>
              <p className="text-xs text-muted-foreground">Usuarios</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <ListTodo className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{agency._count.tasks}</p>
              <p className="text-xs text-muted-foreground">Tareas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Briefcase className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{agency._count.services}</p>
              <p className="text-xs text-muted-foreground">Servicios</p>
            </CardContent>
          </Card>
        </div>

        {/* Agency details */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Información de la agencia</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={agency.isActive ? "default" : "secondary"}>
                {agency.isActive ? "Activa" : "Inactiva"}
              </Badge>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  Editar
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      // Reset form data
                      setFormData({
                        name: agency.name,
                        slug: agency.slug,
                        logoUrl: agency.logoUrl || "",
                        planTier: agency.planTier,
                        maxUsers: agency.maxUsers,
                        billingEmail: agency.billingEmail || "",
                      });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {updateMutation.error && (
              <p className="text-sm text-destructive mb-4">{updateMutation.error.message}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nombre</label>
                {isEditing ? (
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                ) : (
                  <p className="text-sm mt-1">{agency.name}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Slug</label>
                {isEditing ? (
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  />
                ) : (
                  <p className="text-sm mt-1">{agency.slug}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Plan</label>
                {isEditing ? (
                  <select
                    value={formData.planTier}
                    onChange={(e) => setFormData({ ...formData, planTier: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="basic">Básico</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                ) : (
                  <p className="text-sm mt-1 capitalize">{agency.planTier}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Máx. usuarios</label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={formData.maxUsers}
                    onChange={(e) =>
                      setFormData({ ...formData, maxUsers: parseInt(e.target.value) || 50 })
                    }
                  />
                ) : (
                  <p className="text-sm mt-1">{agency.maxUsers}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Email de facturación
                </label>
                {isEditing ? (
                  <Input
                    value={formData.billingEmail}
                    onChange={(e) => setFormData({ ...formData, billingEmail: e.target.value })}
                    placeholder="billing@agencia.com"
                  />
                ) : (
                  <p className="text-sm mt-1">{agency.billingEmail || "—"}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Logo URL</label>
                {isEditing ? (
                  <Input
                    value={formData.logoUrl}
                    onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                    placeholder="https://..."
                  />
                ) : (
                  <p className="text-sm mt-1">{agency.logoUrl || "—"}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Administradores</CardTitle>
          </CardHeader>
          <CardContent>
            {agency.users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay administradores</p>
            ) : (
              <div className="space-y-2">
                {agency.users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {user.name
                          .split(" ")
                          .map((w: string) => w[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={user.isActive ? "default" : "secondary"} className="text-xs">
                        {user.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                      {!user.passwordHash && (
                        <Badge variant="outline" className="text-xs text-orange-600">
                          Pendiente
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Toggle active */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">
                  {agency.isActive ? "Desactivar agencia" : "Activar agencia"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {agency.isActive
                    ? "Los usuarios de esta agencia no podrán iniciar sesión"
                    : "Los usuarios podrán volver a iniciar sesión"}
                </p>
              </div>
              <Button
                variant={agency.isActive ? "destructive" : "default"}
                size="sm"
                onClick={() =>
                  toggleMutation.mutate({ id, isActive: !agency.isActive })
                }
                disabled={toggleMutation.isPending}
              >
                {toggleMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : agency.isActive ? (
                  <ToggleRight className="h-4 w-4 mr-2" />
                ) : (
                  <ToggleLeft className="h-4 w-4 mr-2" />
                )}
                {agency.isActive ? "Desactivar" : "Activar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
