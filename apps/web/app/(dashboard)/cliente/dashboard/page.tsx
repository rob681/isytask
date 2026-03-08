"use client";

import { useMemo } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_CATEGORY_LABELS,
} from "@isytask/shared";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Gauge,
  TrendingUp,
  Briefcase,
  AlertCircle,
  PlusCircle,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DashboardSkeleton } from "@/components/ui/skeleton";

const STATUS_CHART_COLORS: Record<string, string> = {
  RECIBIDA: "#3b82f6",
  EN_PROGRESO: "#f59e0b",
  DUDA: "#ef4444",
  REVISION: "#8b5cf6",
  FINALIZADA: "#22c55e",
  CANCELADA: "#6b7280",
};

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function ClienteDashboardPage() {
  const { data: dashboard } = trpc.metrics.clientDashboard.useQuery();
  const { data: byStatus } = trpc.metrics.clientTasksByStatus.useQuery();
  const { data: byService } = trpc.metrics.clientTasksByService.useQuery();
  const { data: monthlyTrend } = trpc.metrics.clientMonthlyTrend.useQuery();
  const { data: recentActivity } = trpc.metrics.clientRecentActivity.useQuery();

  const statusChartData = useMemo(() => {
    if (!byStatus) return [];
    return byStatus.map((s) => ({
      name: TASK_STATUS_LABELS[s.status] || s.status,
      value: s.count,
      fill: STATUS_CHART_COLORS[s.status] || "#94a3b8",
    }));
  }, [byStatus]);

  const serviceChartData = useMemo(() => {
    if (!byService) return [];
    return byService
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((s) => ({
        name: s.serviceName.length > 18 ? s.serviceName.slice(0, 18) + "…" : s.serviceName,
        tareas: s.count,
      }));
  }, [byService]);

  const trendData = useMemo(() => {
    if (!monthlyTrend) return [];
    return monthlyTrend.map((m) => ({
      name: MONTH_NAMES[m.month - 1],
      creadas: m.created,
    }));
  }, [monthlyTrend]);

  if (!dashboard) {
    return (
      <>
        <Topbar title="Mi Dashboard" />
        <div className="p-6">
          <DashboardSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Mi Dashboard" />
      <div className="p-4 md:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card hover:shadow-md transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                    Tareas Activas
                  </p>
                  <p className="text-3xl font-bold mt-1">{dashboard.active}</p>
                </div>
                <div className="h-11 w-11 rounded-xl gradient-primary flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card hover:shadow-md transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                    En Revisión
                  </p>
                  <p className="text-3xl font-bold mt-1">{dashboard.inReview}</p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card hover:shadow-md transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                    Completadas Este Mes
                  </p>
                  <p className="text-3xl font-bold mt-1">{dashboard.completedThisMonth}</p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-cyan-100 dark:bg-cyan-950 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card hover:shadow-md transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                    Uso Mensual
                  </p>
                  <p className="text-3xl font-bold mt-1">
                    {dashboard.monthlyUsage}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{dashboard.monthlyLimit}
                    </span>
                  </p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                  <Gauge className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              {/* Usage bar */}
              <div className="mt-3">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      dashboard.monthlyRemaining <= 2 ? "bg-red-500" : "gradient-primary"
                    }`}
                    style={{
                      width: `${Math.min(100, (dashboard.monthlyUsage / dashboard.monthlyLimit) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {dashboard.monthlyRemaining > 0
                    ? `${dashboard.monthlyRemaining} tareas restantes`
                    : "Límite mensual alcanzado"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks by Status (Pie) */}
          {statusChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  Tareas por Estado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {statusChartData.map((s) => (
                    <div key={s.name} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                      <span className="text-muted-foreground">
                        {s.name}: {s.value}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tasks by Service */}
          {serviceChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Tareas por Servicio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={serviceChartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="tareas" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Monthly Trend + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Tendencia Mensual {new Date().getFullYear()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="creadas"
                    name="Creadas"
                    stroke="#3b82f6"
                    fill="#3b82f680"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Actividad Reciente
                </CardTitle>
                <Link
                  href="/cliente/tareas"
                  className="text-xs text-primary hover:underline"
                >
                  Ver todas
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentActivity && recentActivity.length > 0 ? (
                <div className="space-y-2">
                  {recentActivity.map((task) => (
                    <Link
                      key={task.id}
                      href={`/cliente/tareas/${task.id}`}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {task.title}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] flex-shrink-0 ${TASK_STATUS_COLORS[task.status]}`}
                          >
                            {TASK_STATUS_LABELS[task.status]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {task.service.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(task.updatedAt), "dd MMM", { locale: es })}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Sin actividad reciente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick action */}
        <div className="flex justify-center">
          <Link href="/cliente/nueva-tarea">
            <button className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white hover:opacity-90 transition-all font-semibold shadow-lg">
              <PlusCircle className="h-5 w-5" />
              Crear Nueva Tarea
            </button>
          </Link>
        </div>
      </div>
    </>
  );
}
