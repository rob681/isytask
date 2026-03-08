"use client";

import { useState, useRef } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import { Camera, Save, Loader2, RotateCcw, CreditCard, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { useTourReset } from "@/components/tour/guided-tour";

export default function PerfilPage() {
  const { data: session, update: updateSession } = useSession();
  const { data: profile, isLoading } = trpc.users.me.useQuery();
  const utils = trpc.useUtils();

  // Client plan data (only fetched for CLIENTE role)
  const isClient = (session?.user as any)?.role === "CLIENTE";
  const { data: clientDashboard } = trpc.metrics.clientDashboard.useQuery(undefined, {
    enabled: isClient,
  });

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form with profile data
  if (profile && !initialized) {
    setName(profile.name || "");
    setAvatarUrl(profile.avatarUrl);
    setInitialized(true);
  }

  const updateProfileMutation = trpc.users.updateProfile.useMutation({
    onSuccess: async (data) => {
      utils.users.me.invalidate();
      // Update session with new data
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          name: data.name,
          avatarUrl: data.avatarUrl,
        },
      });
    },
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("El archivo excede 2MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "avatar");

      const res = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al subir imagen");
        return;
      }

      const { url } = await res.json();
      setAvatarUrl(url);
    } catch {
      alert("Error al subir imagen");
    } finally {
      setUploading(false);
    }
  }

  function handleSave() {
    updateProfileMutation.mutate({
      name: name || undefined,
      avatarUrl,
    });
  }

  const role = (session?.user as any)?.role;
  const resetTour = useTourReset();

  if (isLoading) {
    return (
      <>
        <Topbar title="Mi Perfil" />
        <div className="p-6">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Mi Perfil" />
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-6">Foto de Perfil</h3>

          <div className="flex items-center gap-6">
            {/* Avatar preview */}
            <div className="relative group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full object-cover border-2 border-muted"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold border-2 border-muted">
                  {profile?.name
                    ? profile.name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    : "?"}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleUpload}
              />
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Subiendo..." : "Cambiar foto"}
              </Button>
              {avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setAvatarUrl(null)}
                >
                  Eliminar
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                PNG, JPG, SVG o WebP. Máximo 2MB.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Información</h3>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nombre</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre completo"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Correo electrónico</label>
              <Input value={profile?.email || ""} disabled />
              <p className="text-xs text-muted-foreground mt-1">
                El correo no se puede cambiar
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Rol</label>
              <Input
                value={
                  role === "ADMIN"
                    ? "Administrador"
                    : role === "COLABORADOR"
                      ? "Equipo"
                      : "Cliente"
                }
                disabled
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={updateProfileMutation.isLoading}
            >
              {updateProfileMutation.isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar cambios
            </Button>
          </div>

          {updateProfileMutation.isSuccess && (
            <p className="text-sm text-green-600 mt-2 text-right">
              Perfil actualizado correctamente
            </p>
          )}
        </Card>

        {/* Mi Plan - only for clients */}
        {isClient && clientDashboard?.planName && (
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Mi Plan</h3>
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      {clientDashboard.planName}
                    </Badge>
                  </div>
                  {clientDashboard.planDescription && (
                    <p className="text-xs text-muted-foreground mt-0.5">{clientDashboard.planDescription}</p>
                  )}
                </div>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tareas por mes</p>
                  <p className="text-lg font-bold">{clientDashboard.monthlyLimit}</p>
                  <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, (clientDashboard.monthlyUsage / clientDashboard.monthlyLimit) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {clientDashboard.monthlyUsage} usadas · {clientDashboard.monthlyRemaining} restantes
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Revisiones por tarea</p>
                  <p className="text-lg font-bold">{clientDashboard.revisionLimitPerTask}</p>
                </div>
              </div>
              {clientDashboard.allowedServices && clientDashboard.allowedServices.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Shield className="h-3 w-3" />
                    Servicios incluidos
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {clientDashboard.allowedServices.map((svc: { id: string; name: string }) => (
                      <Badge key={svc.id} variant="outline" className="text-xs">
                        {svc.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tour reset */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Tour de Bienvenida</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reinicia el tour guiado para conocer las funciones de la plataforma
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetTour}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reiniciar Tour
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
