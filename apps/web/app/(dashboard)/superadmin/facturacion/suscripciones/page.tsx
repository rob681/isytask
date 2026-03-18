"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import {
  CreditCard, Receipt, TrendingUp, XCircle, ChevronLeft, ChevronRight,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  trial: "Trial",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  trial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  past_due: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  canceled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function SuscripcionesPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [productFilter, setProductFilter] = useState<"ISYTASK" | "ISYSOCIAL" | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.platform.facturacionSubscriptions.useQuery({
    status: statusFilter,
    product: productFilter,
    page,
    pageSize: 20,
  });

  return (
    <>
      <Topbar title="Suscripciones" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" /> MRR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ${data?.metrics.mrr.toLocaleString() ?? "0"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Ingreso mensual recurrente</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <CreditCard className="h-4 w-4" /> Activas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {data?.metrics.activeCount ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Suscripciones activas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <XCircle className="h-4 w-4" /> Canceladas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-500">
                {data?.metrics.canceledCount ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Suscripciones canceladas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Receipt className="h-4 w-4" /> Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {data?.metrics.totalCount ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Suscripciones totales</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter ?? ""}
            onChange={(e) => {
              setStatusFilter(e.target.value || undefined);
              setPage(1);
            }}
          >
            <option value="">Todos los estados</option>
            <option value="active">Activa</option>
            <option value="trial">Trial</option>
            <option value="past_due">Pago pendiente</option>
            <option value="canceled">Cancelada</option>
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={productFilter ?? ""}
            onChange={(e) => {
              setProductFilter((e.target.value || undefined) as any);
              setPage(1);
            }}
          >
            <option value="">Todos los productos</option>
            <option value="ISYTASK">Isytask</option>
            <option value="ISYSOCIAL">Isysocial</option>
          </select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Agencia</th>
                    <th className="text-left p-3 font-medium">Producto</th>
                    <th className="text-left p-3 font-medium">Plan</th>
                    <th className="text-left p-3 font-medium">Estado</th>
                    <th className="text-left p-3 font-medium">Período actual</th>
                    <th className="text-left p-3 font-medium">Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        Cargando suscripciones...
                      </td>
                    </tr>
                  ) : data?.subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        No se encontraron suscripciones
                      </td>
                    </tr>
                  ) : (
                    data?.subscriptions.map((sub) => (
                      <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{sub.agency.name}</p>
                            {sub.agency.billingEmail && (
                              <p className="text-xs text-muted-foreground">{sub.agency.billingEmail}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">
                            {sub.product === "ISYTASK" ? "Isytask" : "Isysocial"}
                          </Badge>
                        </td>
                        <td className="p-3 capitalize">{sub.planTier}</td>
                        <td className="p-3">
                          <Badge className={`text-xs ${STATUS_COLORS[sub.status] ?? "bg-muted"}`}>
                            {STATUS_LABELS[sub.status] ?? sub.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {sub.currentPeriodEnd
                            ? `Hasta ${format(new Date(sub.currentPeriodEnd), "dd MMM yyyy", { locale: es })}`
                            : "—"}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {format(new Date(sub.createdAt), "dd MMM yyyy", { locale: es })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {data.page} de {data.totalPages} ({data.total} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
