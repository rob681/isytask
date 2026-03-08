"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  TASK_STATUS_LABELS,
  TASK_CATEGORY_LABELS,
  TASK_STATUS_COLORS,
  TASK_CATEGORY_BADGE_COLORS,
} from "@isytask/shared";
import {
  Clock,
  MessageCircle,
  Paperclip,
  LayoutGrid,
  List,
  BarChart3,
  CheckCircle2,
  ListTodo,
  Eye,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { KanbanBoard } from "@/components/kanban/kanban-board";
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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { SlaIndicator } from "@/components/sla-indicator";

type ViewMode = "dashboard" | "list" | "kanban";

const STATUS_CHART_COLORS: Record<string, string> = {
  RECIBIDA: "#eab308",
  EN_PROGRESO: "#3b82f6",
  DUDA: "#f97316",
  REVISION: "#8b5cf6",
  FINALIZADA: "#22c55e",
  CANCELADA: "#ef4444",
};

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export default function EquipoPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");

  // Dashboard data
  const { data: dashboard } = trpc.metrics.myDashboard.useQuery(undefined, {
    enabled: viewMode === "dashboard",
  });
  const { data: myByStatus } = trpc.metrics.myTasksByStatus.useQuery(undefined, {
    enabled: viewMode === "dashboard",
  });
  const { data: myByClient } = trpc.metrics.myTasksByClient.useQuery(undefined, {
    enabled: viewMode === "dashboard",
  });
  const { data: myRecent } = trpc.metrics.myRecentActivity.useQuery(undefined, {
    enabled: viewMode === "dashboard",
  });
  const { data: myMonthly } = trpc.metrics.myMonthlyTrend.useQuery(undefined, {
    enabled: viewMode === "dashboard",
  });

  // List data
  const { data: tasks, isLoading } = trpc.tasks.getAssigned.useQuery(
    {},
    { enabled: viewMode === "list" }
  );

  // Chart data
  const statusChartData =
    myByStatus?.map((item) => ({
      name: TASK_STATUS_LABELS[item.status as keyof typeof TASK_STATUS_LABELS] ?? item.status,
      value: item.count,
      fill: STATUS_CHART_COLORS[item.status] ?? "#94a3b8",
    })) ?? [];

  const clientChartData =
    myByClient
      ?.sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((item) => ({
        name: item.clientName.length > 12 ? item.clientName.slice(0, 12) + "…" : item.clientName,
        tareas: item.count,
      })) ?? [];

  const monthlyChartData =
    myMonthly?.map((item) => ({
      name: MONTH_NAMES[item.month - 1],
      completadas: item.completed,
    })) ?? [];

  const stats = dashboard
    ? [
        {
          label: "Tareas Activas",
          value: dashboard.active,
          icon: <ListTodo className="h-5 w-5 text-blue-500" />,
          sub: "En progreso + Dudas + Recibidas",
          color: "text-blue-600",
        },
        {
          label: "En Revisión",
          value: dashboard.inReview,
          icon: <Eye className="h-5 w-5 text-purple-500" />,
          sub: "Pendientes de aprobación",
          color: "text-purple-600",
        },
        {
          label: "Completadas este mes",
          value: dashboard.completedThisMonth,
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          sub: format(new Date(), "MMMM yyyy", { locale: es }),
          color: "text-green-600",
        },
        {
          label: "Tiempo promedio",
          value: `${dashboard.avgCompletionHours}h`,
          icon: <Clock className="h-5 w-5 text-orange-500" />,
          sub: "Hrs para completar",
          color: "text-orange-600",
        },
      ]
    : [];

  return (
    <>
      <Topbar title="Mi Espacio de Trabajo" />
      <div className="p-6 space-y-4">
        {/* View toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border bg-muted p-0.5">
            <button
              onClick={() => setViewMode("dashboard")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "dashboard"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Lista
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "kanban"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </button>
          </div>
          {viewMode !== "dashboard" && (
            <span className="text-sm text-muted-foreground">
              {dashboard ? `${dashboard.totalAssigned} tareas asignadas` : ""}
            </span>
          )}
        </div>

        {/* ─── Dashboard View ─────────────────────── */}
        {viewMode === "dashboard" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                          {stat.label}
                        </p>
                        <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                      </div>
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        {stat.icon}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tasks by Status */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Mis Tareas por Estado</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={statusChartData} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="value" name="Tareas" radius={[0, 4, 4, 0]}>
                          {statusChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">Sin datos</p>
                  )}
                </CardContent>
              </Card>

              {/* Tasks by Client */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tareas por Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                  {clientChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={clientChartData} margin={{ left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="tareas" name="Tareas" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">Sin datos</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Monthly trend + Recent activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Monthly Trend */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">
                      Completadas por Mes ({new Date().getFullYear()})
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={monthlyChartData} margin={{ left: -10 }}>
                      <defs>
                        <linearGradient id="colabGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="completadas"
                        name="Completadas"
                        stroke="#22c55e"
                        fill="url(#colabGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Actividad Reciente</CardTitle>
                    <button
                      onClick={() => setViewMode("list")}
                      className="text-xs text-muted-foreground hover:text-primary"
                    >
                      Ver todas →
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {myRecent?.map((task) => (
                      <Link
                        key={task.id}
                        href={`/equipo/tareas/${task.id}`}
                        className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold flex items-center justify-center">
                            {task.taskNumber}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate">{task.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {task.client.companyName ?? task.client.user.name} · {task.service.name}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {task.dueAt && (
                            <SlaIndicator
                              dueAt={new Date(task.dueAt)}
                              status={task.status}
                              compact
                            />
                          )}
                          <Badge
                            className={TASK_STATUS_COLORS[task.status as keyof typeof TASK_STATUS_COLORS]}
                            variant="outline"
                          >
                            {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}
                          </Badge>
                          <span className="text-xs text-muted-foreground hidden sm:block">
                            {format(new Date(task.updatedAt), "dd MMM", { locale: es })}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    ))}
                    {!myRecent?.length && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Sin actividad reciente
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ─── Kanban View ─────────────────────── */}
        {viewMode === "kanban" && <KanbanBoard showFilters={false} />}

        {/* ─── List View ─────────────────────── */}
        {viewMode === "list" && (
          <>
            {isLoading ? (
              <p className="text-muted-foreground">Cargando tareas...</p>
            ) : tasks?.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">
                No tienes tareas asignadas
              </p>
            ) : (
              tasks?.map((task) => (
                <Link key={task.id} href={`/equipo/tareas/${task.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center mt-0.5">
                            {task.taskNumber}
                          </span>
                          <div>
                            <h3 className="font-semibold">{task.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {task.client.user.name} &middot; {task.service.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={TASK_CATEGORY_BADGE_COLORS[task.category]}>
                            {TASK_CATEGORY_LABELS[task.category]}
                          </Badge>
                          <Badge
                            className={TASK_STATUS_COLORS[task.status]}
                            variant="outline"
                          >
                            {TASK_STATUS_LABELS[task.status]}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.estimatedHours + task.extraHours} hrs estimadas
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {task._count.comments} comentarios
                        </span>
                        <span className="flex items-center gap-1">
                          <Paperclip className="h-3 w-3" />
                          {task._count.attachments} archivos
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </>
        )}
      </div>
    </>
  );
}
