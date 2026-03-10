"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Building2, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { CardListSkeleton } from "@/components/ui/skeleton";

export default function FacturacionDashboard() {
  const { data, isLoading } = trpc.platform.facturacionDashboard.useQuery();

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
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.activeTrials}</p>
                <p className="text-xs text-muted-foreground">Trials activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.expiringSoon.length}</p>
                <p className="text-xs text-muted-foreground">Por vencer (7 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribucion por plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.planDistribution.map((item) => {
              const pct = data.totalAgencies > 0 ? Math.round((item.count / data.totalAgencies) * 100) : 0;
              return (
                <div key={item.plan} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-24 capitalize">{item.plan}</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-16 text-right">
                    {item.count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Expiring trials */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Trials por vencer</CardTitle>
          <Link
            href="/superadmin/facturacion/agencias"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {data.expiringSoon.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay trials por vencer</p>
          ) : (
            <div className="space-y-3">
              {data.expiringSoon.map((agency) => (
                <div
                  key={agency.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
