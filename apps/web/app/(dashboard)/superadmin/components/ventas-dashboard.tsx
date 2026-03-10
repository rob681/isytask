"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Building2, TrendingUp, Clock, Users, ListTodo, ArrowRight } from "lucide-react";
import Link from "next/link";
import { CardListSkeleton } from "@/components/ui/skeleton";

export default function VentasDashboard() {
  const { data, isLoading } = trpc.platform.ventasDashboard.useQuery();

  if (isLoading) return <CardListSkeleton cards={3} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalAgencies}</p>
                <p className="text-xs text-muted-foreground">Agencias totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.recentSignups}</p>
                <p className="text-xs text-muted-foreground">Nuevos (30 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.activeTrials}</p>
                <p className="text-xs text-muted-foreground">Trials activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent signups */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Registros recientes</CardTitle>
          <Link
            href="/superadmin/ventas/agencias"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentAgencies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin registros recientes</p>
          ) : (
            <div className="space-y-3">
              {data.recentAgencies.map((agency) => (
                <div
                  key={agency.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium text-sm">{agency.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(agency.createdAt).toLocaleDateString("es")} · {agency.planTier}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {agency._count.users}
                    </span>
                    <span className="flex items-center gap-1">
                      <ListTodo className="h-3 w-3" /> {agency._count.tasks}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trials expiring soon */}
      {data.trialExpiringSoon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trials por vencer (7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.trialExpiringSoon.map((agency) => (
                <div
                  key={agency.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800"
                >
                  <div>
                    <p className="font-medium text-sm">{agency.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{agency.planTier}</p>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    Vence {agency.trialEndsAt ? new Date(agency.trialEndsAt).toLocaleDateString("es") : "—"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
