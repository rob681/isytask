"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { Search, Building2, Users, ListTodo, ChevronLeft, ChevronRight } from "lucide-react";
import { CardListSkeleton } from "@/components/ui/skeleton";

export default function SoporteAgenciasPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.platform.soporteAgencies.useQuery({
    search: search || undefined,
    page,
  });

  return (
    <>
      <Topbar title="Agencias — Soporte" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar agencia..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <CardListSkeleton cards={5} />
        ) : !data || data.agencies.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No se encontraron agencias
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{data.total} agencias encontradas</p>
            <div className="space-y-2">
              {data.agencies.map((agency) => (
                <Card key={agency.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{agency.name}</p>
                        <p className="text-xs text-muted-foreground">{agency.slug} · {agency.planTier}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> {agency._count.users}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <ListTodo className="h-3 w-3" /> {agency._count.tasks}
                      </span>
                      <Badge variant={agency.isActive ? "default" : "secondary"}>
                        {agency.isActive ? "Activa" : "Inactiva"}
                      </Badge>
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
