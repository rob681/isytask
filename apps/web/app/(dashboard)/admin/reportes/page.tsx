"use client";

import { useState, useMemo } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  X,
  UserCircle,
  Briefcase,
  Users,
  BarChart3,
  Clock,
  Target,
  AlertTriangle,
  FileDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import { es } from "date-fns/locale";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type DatePreset = "month" | "year" | "custom" | "all";
type ReportView = "service" | "colaborador" | "client";

const PRESET_LABELS: Record<DatePreset, string> = {
  month: "Este mes",
  year: "Este año",
  custom: "Personalizado",
  all: "Todo",
};

function EfficiencyBadge({ efficiency }: { efficiency: number }) {
  if (efficiency >= 100) {
    return (
      <Badge className="!bg-green-100 !text-green-700 dark:!bg-green-950 dark:!text-green-300 gap-1">
        <TrendingUp className="h-3 w-3" />
        {efficiency}%
      </Badge>
    );
  }
  if (efficiency >= 75) {
    return (
      <Badge className="!bg-yellow-100 !text-yellow-700 dark:!bg-yellow-950 dark:!text-yellow-300 gap-1">
        <Minus className="h-3 w-3" />
        {efficiency}%
      </Badge>
    );
  }
  return (
    <Badge className="!bg-red-100 !text-red-700 dark:!bg-red-950 dark:!text-red-300 gap-1">
      <TrendingDown className="h-3 w-3" />
      {efficiency}%
    </Badge>
  );
}

export default function ReportesPage() {
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [reportView, setReportView] = useState<ReportView>("service");

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
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

  const filters = useMemo(() => ({ ...dateRange }), [dateRange]);

  const { data: byService } = trpc.metrics.profitabilityByService.useQuery(filters, {
    enabled: reportView === "service",
  });
  const { data: byColaborador } = trpc.metrics.profitabilityByColaborador.useQuery(filters, {
    enabled: reportView === "colaborador",
  });
  const { data: byClient } = trpc.metrics.profitabilityByClient.useQuery(filters, {
    enabled: reportView === "client",
  });

  const activeData = reportView === "service" ? byService : reportView === "colaborador" ? byColaborador : byClient;

  // Compute overall KPIs
  const overallKpis = useMemo(() => {
    if (!activeData || activeData.length === 0) return null;
    const totalEstimated = activeData.reduce((s, d) => s + d.estimated, 0);
    const totalActual = activeData.reduce((s, d) => s + d.actual, 0);
    const totalExtra = activeData.reduce((s, d) => s + d.extra, 0);
    const totalTasks = activeData.reduce((s, d) => s + d.count, 0);
    const overallEfficiency = totalActual > 0 ? Math.round((totalEstimated / totalActual) * 100) : 0;
    return { totalEstimated: Math.round(totalEstimated * 10) / 10, totalActual: Math.round(totalActual * 10) / 10, totalExtra, totalTasks, overallEfficiency };
  }, [activeData]);

  // Chart data
  const chartData = useMemo(() => {
    if (!activeData) return [];
    const nameKey = reportView === "service" ? "serviceName" : reportView === "colaborador" ? "colaboradorName" : "clientName";
    return activeData.map((d: any) => ({
      name: d[nameKey].length > 15 ? d[nameKey].slice(0, 15) + "…" : d[nameKey],
      estimadas: Math.round(d.estimated * 10) / 10,
      reales: Math.round(d.actual * 10) / 10,
    }));
  }, [activeData, reportView]);

  const hasFilters = datePreset !== "all";

  const exportPDF = () => {
    if (!activeData || activeData.length === 0 || !overallKpis) return;

    const doc = new jsPDF();
    const viewLabel = reportView === "service" ? "Servicio" : reportView === "colaborador" ? "Colaborador" : "Cliente";
    const dateLabel =
      datePreset === "all"
        ? "Todo el período"
        : datePreset === "month"
          ? "Este mes"
          : datePreset === "year"
            ? "Este año"
            : `${customFrom || "..."} a ${customTo || "..."}`;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Reporte de Rentabilidad", 14, 22);

    // Subtitle
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Por ${viewLabel} — ${dateLabel}`, 14, 30);
    doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 36);

    // KPI Summary
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen General", 14, 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Tareas completadas: ${overallKpis.totalTasks}`, 14, 56);
    doc.text(`Horas estimadas: ${overallKpis.totalEstimated}h`, 14, 62);
    doc.text(`Horas reales: ${overallKpis.totalActual}h`, 14, 68);
    doc.text(`Horas extra: ${overallKpis.totalExtra}h`, 14, 74);
    doc.text(`Eficiencia global: ${overallKpis.overallEfficiency}%`, 14, 80);

    // Table
    const nameKey = reportView === "service" ? "serviceName" : reportView === "colaborador" ? "colaboradorName" : "clientName";
    const tableData = activeData.map((row: any) => {
      const diff = Math.round((row.estimated - row.actual) * 10) / 10;
      return [
        row[nameKey],
        row.count.toString(),
        `${row.estimated}h`,
        `${row.actual}h`,
        `${row.extra}h`,
        `${diff >= 0 ? "+" : ""}${diff}h`,
        `${row.efficiency}%`,
      ];
    });

    autoTable(doc, {
      startY: 88,
      head: [[viewLabel, "Tareas", "Estimadas", "Reales", "Extra", "Diferencia", "Eficiencia"]],
      body: tableData,
      headStyles: {
        fillColor: [34, 139, 34],
        textColor: 255,
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Isytask — Página ${i} de ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    doc.save(`reporte-rentabilidad-${viewLabel.toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <>
      <Topbar title="Reporte de Rentabilidad" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Análisis de horas estimadas vs. reales para evaluar la rentabilidad del trabajo
          </p>
          {activeData && activeData.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={exportPDF}
            >
              <FileDown className="h-4 w-4" />
              Exportar PDF
            </Button>
          )}
        </div>

        {/* View switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border bg-muted p-0.5">
            <button
              onClick={() => setReportView("service")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                reportView === "service"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              Por Servicio
            </button>
            <button
              onClick={() => setReportView("colaborador")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                reportView === "colaborador"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Por Colaborador
            </button>
            <button
              onClick={() => setReportView("client")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                reportView === "client"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCircle className="h-3.5 w-3.5" />
              Por Cliente
            </button>
          </div>
        </div>

        {/* Date filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex gap-1.5">
                {(Object.keys(PRESET_LABELS) as DatePreset[])
                  .filter((p) => p !== "custom")
                  .map((preset) => (
                    <Button
                      key={preset}
                      variant={datePreset === preset ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setDatePreset(preset)}
                    >
                      {PRESET_LABELS[preset]}
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
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => {
                    setDatePreset("all");
                    setCustomFrom("");
                    setCustomTo("");
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Overall KPIs */}
        {overallKpis && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Tareas completadas</p>
                <p className="text-2xl font-bold mt-1">{overallKpis.totalTasks}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Horas Estimadas</p>
                <p className="text-2xl font-bold mt-1 text-blue-600">{overallKpis.totalEstimated}h</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Horas Reales</p>
                <p className="text-2xl font-bold mt-1 text-orange-600">{overallKpis.totalActual}h</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Horas Extra</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{overallKpis.totalExtra}h</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Eficiencia Global</p>
                <div className="mt-1">
                  <EfficiencyBadge efficiency={overallKpis.overallEfficiency} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {overallKpis.overallEfficiency >= 100
                    ? "Dentro del presupuesto"
                    : "Excediendo presupuesto"}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Chart: Estimated vs Actual */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">
                  Horas Estimadas vs. Reales — por{" "}
                  {reportView === "service" ? "Servicio" : reportView === "colaborador" ? "Colaborador" : "Cliente"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 50)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="estimadas" name="Estimadas" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="reales" name="Reales" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Detailed table */}
        {activeData && activeData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-muted-foreground">
                        {reportView === "service" ? "Servicio" : reportView === "colaborador" ? "Colaborador" : "Cliente"}
                      </th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Tareas</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Estimadas</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Reales</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Extra</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Diferencia</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Eficiencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeData.map((row: any) => {
                      const name = reportView === "service" ? row.serviceName : reportView === "colaborador" ? row.colaboradorName : row.clientName;
                      const diff = Math.round((row.estimated - row.actual) * 10) / 10;
                      return (
                        <tr key={row.serviceId ?? row.colaboradorId ?? row.clientId} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-3 font-medium">{name}</td>
                          <td className="py-3 text-right">{row.count}</td>
                          <td className="py-3 text-right text-blue-600">{row.estimated}h</td>
                          <td className="py-3 text-right text-orange-600">{row.actual}h</td>
                          <td className="py-3 text-right text-red-600">{row.extra}h</td>
                          <td className={`py-3 text-right font-medium ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {diff >= 0 ? "+" : ""}{diff}h
                          </td>
                          <td className="py-3 text-right">
                            <EfficiencyBadge efficiency={row.efficiency} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="mt-4 pt-3 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3 text-green-500" />
                  ≥100%: Dentro del presupuesto (terminó antes)
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-yellow-500" />
                  75-99%: Ligeramente sobre presupuesto
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  &lt;75%: Significativamente sobre presupuesto
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {activeData?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">
                No hay tareas completadas en el período seleccionado para generar el reporte.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Los reportes de rentabilidad solo incluyen tareas finalizadas con fechas de inicio y fin.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
