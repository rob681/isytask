"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { ROLE_LABELS } from "@isytask/shared";
import { Plus, Search, Trash2, UserCheck, UserX } from "lucide-react";
import { CardListSkeleton } from "@/components/ui/skeleton";

const STAFF_ROLES = ["SOPORTE", "FACTURACION", "VENTAS", "ANALISTA"] as const;

const ROLE_COLORS: Record<string, string> = {
  SOPORTE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  FACTURACION: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  VENTAS: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  ANALISTA: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
};

export default function StaffPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "SOPORTE" as string });

  const utils = trpc.useUtils();
  const { data: staff, isLoading } = trpc.platform.listStaff.useQuery({ search: search || undefined });
  const createMut = trpc.platform.createStaff.useMutation({
    onSuccess: () => {
      utils.platform.listStaff.invalidate();
      setForm({ name: "", email: "", role: "SOPORTE" });
      setShowCreate(false);
    },
  });
  const toggleMut = trpc.platform.toggleStaffActive.useMutation({
    onSuccess: () => utils.platform.listStaff.invalidate(),
  });
  const deleteMut = trpc.platform.deleteStaff.useMutation({
    onSuccess: () => utils.platform.listStaff.invalidate(),
  });

  return (
    <>
      <Topbar title="Staff de Plataforma" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Actions */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nuevo Staff
          </Button>
        </div>

        {/* Create form */}
        {showCreate && (
          <Card>
            <CardContent className="p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMut.mutate({
                    name: form.name,
                    email: form.email,
                    role: form.role as any,
                  });
                }}
                className="grid grid-cols-1 md:grid-cols-4 gap-3"
              >
                <Input
                  placeholder="Nombre"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r] || r}
                    </option>
                  ))}
                </select>
                <Button type="submit" disabled={createMut.isLoading}>
                  {createMut.isLoading ? "Creando..." : "Crear"}
                </Button>
              </form>
              {createMut.error && (
                <p className="text-sm text-red-500 mt-2">{createMut.error.message}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Staff list */}
        {isLoading ? (
          <CardListSkeleton cards={3} />
        ) : !staff || staff.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No hay staff de plataforma registrado
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {staff.map((user) => (
              <Card key={user.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={ROLE_COLORS[user.role] || ""}>
                      {ROLE_LABELS[user.role] || user.role}
                    </Badge>
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                    {!user.hasPassword && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Pendiente
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleMut.mutate({ id: user.id, isActive: !user.isActive })}
                      title={user.isActive ? "Desactivar" : "Activar"}
                    >
                      {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => {
                        if (confirm(`¿Eliminar a ${user.name}?`)) {
                          deleteMut.mutate({ id: user.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
