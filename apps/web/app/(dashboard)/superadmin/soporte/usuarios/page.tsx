"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { ROLE_LABELS } from "@isytask/shared";
import { Search, UserCheck, UserX, ChevronLeft, ChevronRight } from "lucide-react";
import { CardListSkeleton } from "@/components/ui/skeleton";

export default function SoporteUsuariosPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.platform.soporteUsers.useQuery({
    search: search || undefined,
    page,
  });
  const toggleMut = trpc.platform.soporteToggleUser.useMutation({
    onSuccess: () => utils.platform.soporteUsers.invalidate(),
  });

  return (
    <>
      <Topbar title="Usuarios — Soporte" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuario por nombre o email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <CardListSkeleton cards={5} />
        ) : !data || data.users.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No se encontraron usuarios
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{data.total} usuarios encontrados</p>
            <div className="space-y-2">
              {data.users.map((user) => (
                <Card key={user.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email} · {user.agency?.name || "Sin agencia"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{ROLE_LABELS[user.role] || user.role}</Badge>
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleMut.mutate({ id: user.id, isActive: !user.isActive })}
                        title={user.isActive ? "Desactivar" : "Activar"}
                      >
                        {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">{page} / {data.totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
