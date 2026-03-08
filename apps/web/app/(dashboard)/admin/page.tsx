"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_CATEGORY_LABELS,
} from "@isytask/shared";
import {
  Users,
  ListTodo,
  Clock,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Download,
  Calendar,
  X,
  UserCircle,
} from "lucide-react";
import Link from "next/link";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import { es } from "date-fns/locale";
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

const STATUS_CHART_COLORS: Record<string, string> = {
  RECIBIDA: "#eab308",
  EN_PROGRESO: "#3b82f6",
  DUDA: "#f97316",
  REVISION: "#8b5cf6",
  FINALIZADA: "#22c55e",
  CANCELADA: "#ef4444",
};

const CATEGORY_CHART_COLORS: Record<string, string> = {
  URGENTE: "#ef4444",
  NORMAL: "#22c55e",
  LARGO_PLAZO: "#eab308",
};

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

type DatePreset = "today" | "week" | "month" | "year" | "custom" | "all";

export default function AdminDashboard() {
  // ─── Filter state ────────────────────────────
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");

  // Compute date range from preset
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
      case "today":
        return {
          dateFrom: startOfDay(now).toISOString(),
          dateTo: endOfDay(now).toISOString(),
        };
      case "week":
        return {
          dateFrom: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
          dateTo: endOfWeek(now, { weekStartsOn: 1 }).toISOString(),
        };
      case "month":
        return {
          dateFrom: startOfMonth(now).toISOString(),
          dateTo: endOfMonth(now).toISOString(),
        };
      case "year":
        return {
          dateFrom: startOfYear(now).toISOString(),
          dateTo: endOfYear(now).toISOString(),
        };
      case "custom":
        return {
          dateFrom: customFrom || undefined,
          dateTo: customTo || undefined,
        };
      default:
        return {};
    }
  }, [datePreset, customFrom, customTo]);

  const filters = useMemo(
    () => ({
      ...dateRange,
      clientId: selectedClientId || undefined,
    }),
    [dateRange, selectedClientId]
  );

  // ─── Data queries ────────────────────────────
  const { data: summary } = trpc.metrics.summary.useQuery(filters);
  const { data: byStatus } = trpc.metrics.tasksByStatus.useQuery(filters);
  const { data: byCategory } = trpc.metrics.tasksByCategory.useQuery(filters);
  const { data: byClient } = trpc.metrics.tasksByClient.useQuery(filters);
  const { data: byMonth } = trpc.metrics.tasksByMonth.useQuery({
    clientId: selectedClientId || undefined,
  });
  const { data: recentActivity } = trpc.metrics.recentActivity.useQuery(filters);
  const { data: workload } = trpc.metrics.colaboradorWorkload.useQuery(filters);

  // Client list for filter dropdown
  const { data: clientsData } = trpc.clients.list.useQuery({
    page: 1,
    pageSize: 100,
  });

  // ─── Auto-check pending task reminders on load ─────
  const reminderCheckedRef = useRef(false);
  useEffect(() => {
    if (!reminderCheckedRef.current) {
      reminderCheckedRef.current = true;
      fetch("/api/cron/pending-reminders", { method: "POST" }).catch(() => {});
    }
  }, []);

  // ─── Excel export ────────────────────────────
  const { data: exportData, refetch: fetchExport, isFetching: isExporting } =
    trpc.metrics.exportData.useQuery(filters, { enabled: false });

  const handleExport = async () => {
    const result = await fetchExport();
    const data = result.data;
    if (!data || data.length === 0) {
      alert("No hay datos para exportar con los filtros seleccionados");
      return;
    }

    // Dynamically import xlsx
    const XLSX = await import("xlsx");

    const statusLabels: Record<string, string> = {
      RECIBIDA: "Recibida",
      EN_PROGRESO: "En progreso",
      DUDA: "Duda",
      REVISION: "En revisión",
      FINALIZADA: "Finalizada",
      CANCELADA: "Cancelada",
    };
    const categoryLabels: Record<string, string> = {
      URGENTE: "Urgente",
      NORMAL: "Normal",
      LARGO_PLAZO: "Largo plazo",
    };

    const rows = data.map((t) => ({
      "#": t.numero,
      Título: t.titulo,
      Estado: statusLabels[t.estado] ?? t.estado,
      Categoría: categoryLabels[t.categoria] ?? t.categoria,
      Servicio: t.servicio,
      Cliente: t.cliente,
      Colaborador: t.colaborador,
      "Horas Estimadas": t.horasEstimadas,
      "Horas Extra": t.horasExtra,
      "Fecha Creación": t.fechaCreacion
        ? format(new Date(t.fechaCreacion), "dd/MM/yyyy HH:mm", { locale: es })
        : "",
      "Fecha Inicio": t.fechaInicio
        ? format(new Date(t.fechaInicio), "dd/MM/yyyy HH:mm", { locale: es })
        : "",
      "Fecha Completado": t.fechaCompletado
        ? format(new Date(t.fechaCompletado), "dd/MM/yyyy HH:mm", { locale: es })
        : "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-width columns
    const colWidths = Object.keys(rows[0]).map((key) => ({
      wch: Math.max(
        key.length,
        ...rows.map((r) => String((r as any)[key] ?? "").length)
      ) + 2,
    }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tareas");
    XLSX.writeFile(
      wb,
      `isytask-estadisticas-${format(new Date(), "yyyy-MM-dd")}.xlsx`
    );
  };

  // ─── Chart data ────────────────────────────
  const statusChartData =
    byStatus?.map((item) => ({
      name: TASK_STATUS_LABELS[item.status as keyof typeof TASK_STATUS_LABELS] ?? item.status,
      value: item.count,
      fill: STATUS_CHART_COLORS[item.status] ?? "#94a3b8",
    })) ?? [];

  const categoryChartData =
    byCategory?.map((item) => ({
      name: TASK_CATEGORY_LABELS[item.category as keyof typeof TASK_CATEGORY_LABELS] ?? item.category,
      value: item.count,
      fill: CATEGORY_CHART_COLORS[item.category] ?? "#94a3b8",
    })) ?? [];

  const monthlyChartData =
    byMonth?.map((item) => ({
      name: MONTH_NAMES[item.month - 1],
      tareas: item.count,
    })) ?? [];

  const clientChartData =
    byClient
      ?.sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((item) => ({
        name: item.clientName.length > 15 ? item.clientName.slice(0, 15) + "…" : item.clientName,
        tareas: item.count,
      })) ?? [];

  const stats = [
    {
      label: "Total de Tareas",
      value: summary?.totalTasks ?? 0,
      icon: <ListTodo className="h-5 w-5 text-primary" />,
      sub: `${summary?.newThisMonth ?? 0} este mes`,
    },
    {
      label: "Tareas Activas",
      value: summary?.activeTasks ?? 0,
      icon: <Clock className="h-5 w-5 text-orange-500" />,
      sub: "En progreso + Dudas",
    },
    {
      label: "Completadas este mes",
      value: summary?.completedThisMonth ?? 0,
      icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      sub: format(new Date(), "MMMM yyyy", { locale: es }),
    },
    {
      label: "Clientes / Equipo",
      value: `${summary?.totalClients ?? 0} / ${summary?.totalColaboradores ?? 0}`,
      icon: <Users className="h-5 w-5 text-blue-500" />,
      sub: "Registrados",
    },
  ];

  const presetLabels: Record<DatePreset, string> = {
    all: "Todo",
    today: "Hoy",
    week: "Esta semana",
    month: "Este mes",
    year: "Este año",
    custom: "Personalizado",
  };

  const hasFilters = datePreset !== "all" || selectedClientId;
  const selectedClientName = clientsData?.clients.find(
    (c) => c.id === selectedClientId
  );

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="p-6 space-y-6">
        {/* ─── Filters bar ─────────────────────────── */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Período:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(presetLabels) as DatePreset[]).filter(p => p !== "custom").map((preset) => (
                  <Button
                    key={preset}
                    variant={datePreset === preset ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setDatePreset(preset)}
                  >
                    {presetLabels[preset]}
                  </Button>
                ))}
                <Button
                  variant={datePreset === "custom" ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDatePreset("custom")}
                >
                  Personalizado
                </Button>
              </div>

              {datePreset === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">a</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                  />
                </div>
              )}

              <div className="h-6 w-px bg-border mx-1" />

              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <UserCircle className="h-4 w-4" />
                Cliente:
              </div>
              <select
                className="h-7 rounded-md border border-input bg-background px-2 text-xs min-w-[140px]"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
              >
                <option value="">Todos los clientes</option>
                {clientsData?.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName
                      ? `${c.companyName} (${c.user.name})`
                      : c.user.name}
                  </option>
                ))}
              </select>

              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => {
                    setDatePreset("all");
                    setSelectedClientId("");
                    setCustomFrom("");
                    setCustomTo("");
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpiar filtros
                </Button>
              )}

              <div className="ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  <Download className="h-3 w-3 mr-1" />
                  {isExporting ? "Exportando..." : "Exportar Excel"}
                </Button>
              </div>
            </div>

            {/* Active filter summary */}
            {hasFilters && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                {datePreset !== "all" && datePreset !== "custom" && (
                  <Badge variant="secondary" className="text-xs">
                    {presetLabels[datePreset]}
                  </Badge>
                )}
                {datePreset === "custom" && (customFrom || customTo) && (
                  <Badge variant="secondary" className="text-xs">
                    {customFrom ? format(new Date(customFrom + "T00:00:00"), "dd/MM/yyyy") : "..."}
                    {" → "}
                    {customTo ? format(new Date(customTo + "T00:00:00"), "dd/MM/yyyy") : "..."}
                  </Badge>
                )}
                {selectedClientId && selectedClientName && (
                  <Badge variant="secondary" className="text-xs">
                    Cliente: {selectedClientName.companyName ?? selectedClientName.user.name}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
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

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks by Status - Bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tareas por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              {statusChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
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

          {/* Tasks by Category - Pie chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tareas por Categoría</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryChartData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="60%" height={240}>
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        dataKey="value"
                        stroke="none"
                      >
                        {categoryChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    {categoryChartData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.fill }}
                        />
                        <span className="text-sm">{item.name}</span>
                        <span className="text-sm font-bold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">Sin datos</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly trend */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Tareas por Mes ({new Date().getFullYear()})</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={monthlyChartData} margin={{ left: -10 }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="tareas"
                    name="Tareas"
                    stroke="#3b82f6"
                    fill="url(#areaGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tasks by Client */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Tareas por Cliente</CardTitle>
                <Link href="/admin/clientes" className="text-xs text-muted-foreground hover:text-primary">
                  Ver todos →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {clientChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
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

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent activity */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Actividad Reciente</CardTitle>
                <Link href="/admin/tareas" className="text-xs text-muted-foreground hover:text-primary">
                  Ver todas →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity?.map((task) => (
                  <Link
                    key={task.id}
                    href={`/admin/tareas/${task.id}`}
                    className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold flex items-center justify-center">
                        {task.taskNumber}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">
                          {task.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {task.client.companyName ?? task.client.user.name} · {task.service.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
                {!recentActivity?.length && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin actividad reciente</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Collaborator workload */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Carga de Trabajo</CardTitle>
                <Link href="/admin/equipo" className="text-xs text-muted-foreground hover:text-primary">
                  Ver equipo →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {workload?.map((colab) => (
                  <div key={colab.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {colab.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="text-sm truncate">{colab.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(colab.activeTasks * 20, 100)}%`,
                            backgroundColor:
                              colab.activeTasks >= 5
                                ? "#ef4444"
                                : colab.activeTasks >= 3
                                  ? "#f97316"
                                  : "#22c55e",
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-6 text-right">{colab.activeTasks}</span>
                    </div>
                  </div>
                ))}
                {!workload?.length && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin colaboradores</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
