"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Building2, Users, ListTodo, Clock } from "lucide-react";
import { CardListSkeleton } from "@/components/ui/skeleton";

export default function VentasAgenciasPage() {
  const { data, isLoading } = trpc.platform.ventasDashboard.useQuery();

  if (isLoading) return (
    <>
      <Topbar title="Agencias — Ventas" />
      <div className="p-4 md:p-6"><CardListSkeleton cards={5} /></div>
    </>
  );
  if (!data) return null;

  return (
    <>
      <Topbar title="Agencias — Ventas" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Recent signups */}
        <div>
          <h3 className="font-semibold text-sm mb-3">Registros recientes (30 dias)</h3>
          {data.recentAgencies.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Sin registros recientes
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {data.recentAgencies.map((agency) => (
                <Card key={agency.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{agency.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Registrada {new Date(agency.createdAt).toLocaleDateString("es")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="capitalize">{agency.planTier}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> {agency._count.users}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <ListTodo className="h-3 w-3" /> {agency._count.tasks}
                      </span>
                      {agency.trialEndsAt && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Trial → {new Date(agency.trialEndsAt).toLocaleDateString("es")}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Trials expiring soon */}
        {data.trialExpiringSoon.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-3">Trials por vencer (7 dias)</h3>
            <div className="space-y-2">
              {data.trialExpiringSoon.map((agency) => (
                <Card key={agency.id} className="border-amber-200 dark:border-amber-800">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{agency.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{agency.planTier}</p>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      Vence {agency.trialEndsAt ? new Date(agency.trialEndsAt).toLocaleDateString("es") : "—"}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
