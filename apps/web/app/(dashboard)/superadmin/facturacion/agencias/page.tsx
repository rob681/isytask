"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { Search, Building2, Users, Pencil, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { CardListSkeleton } from "@/components/ui/skeleton";

const PLAN_OPTIONS = ["trial", "basic", "pro", "enterprise"];

export default function FacturacionAgenciasPage() {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState({ planTier: "", maxUsers: 0, billingEmail: "" });

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.platform.facturacionAgencies.useQuery({
    search: search || undefined,
    planTier: planFilter || undefined,
    page,
  });
  const updateMut = trpc.platform.facturacionUpdateAgency.useMutation({
    onSuccess: () => {
      utils.platform.facturacionAgencies.invalidate();
      setEditing(null);
    },
  });

  return (
    <>
      <Topbar title="Agencias — Facturacion" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar agencia o email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1">
            <Button
              variant={planFilter === "" ? "default" : "outline"}
              size="sm"
              onClick={() => { setPlanFilter(""); setPage(1); }}
            >
              Todos
            </Button>
            {PLAN_OPTIONS.map((plan) => (
              <Button
                key={plan}
                variant={planFilter === plan ? "default" : "outline"}
                size="sm"
                onClick={() => { setPlanFilter(plan); setPage(1); }}
                className="capitalize"
              >
                {plan}
              </Button>
            ))}
          </div>
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
            <p className="text-sm text-muted-foreground">{data.total} agencias</p>
            <div className="space-y-2">
              {data.agencies.map((agency) => (
                <Card key={agency.id}>
                  <CardContent className="p-4">
                    {editing === agency.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Plan</label>
                            <select
                              value={editData.planTier}
                              onChange={(e) => setEditData({ ...editData, planTier: e.target.value })}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {PLAN_OPTIONS.map((p) => (
                                <option key={p} value={p} className="capitalize">{p}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Max usuarios</label>
                            <Input
                              type="number"
                              value={editData.maxUsers}
                              onChange={(e) => setEditData({ ...editData, maxUsers: parseInt(e.target.value) || 1 })}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Email facturacion</label>
                            <Input
                              value={editData.billingEmail}
                              onChange={(e) => setEditData({ ...editData, billingEmail: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              updateMut.mutate({
                                id: agency.id,
                                planTier: editData.planTier,
                                maxUsers: editData.maxUsers,
                                billingEmail: editData.billingEmail || null,
                              })
                            }
                            disabled={updateMut.isLoading}
                          >
                            <Check className="h-4 w-4 mr-1" /> Guardar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                            <X className="h-4 w-4 mr-1" /> Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{agency.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {agency.billingEmail || "Sin email"} · Max {agency.maxUsers} usuarios
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="capitalize">{agency.planTier}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" /> {agency._count.users}
                          </span>
                          {agency.trialEndsAt && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              Trial → {new Date(agency.trialEndsAt).toLocaleDateString("es")}
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(agency.id);
                              setEditData({
                                planTier: agency.planTier,
                                maxUsers: agency.maxUsers,
                                billingEmail: agency.billingEmail || "",
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
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
