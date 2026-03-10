"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Building2, Users, ListTodo, Briefcase, TrendingUp, ArrowRight } from "lucide-react";
import Link from "next/link";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@isytask/shared";
import { CardListSkeleton } from "@/components/ui/skeleton";

export default function AnalistaDashboard() {
  const { data, isLoading } = trpc.platform.analistaDashboard.useQuery();

  if (isLoading) return <CardListSkeleton cards={4} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalAgencies}</p>
                <p className="text-xs text-muted-foreground">Agencias</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalUsers}</p>
                <p className="text-xs text-muted-foreground">Usuarios</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                <ListTodo className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalTasks}</p>
                <p className="text-xs text-muted-foreground">Tareas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 text-cyan-600">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalServices}</p>
                <p className="text-xs text-muted-foreground">Servicios</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.activeAgencies}</p>
                <p className="text-xs text-muted-foreground">Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Growth 30d */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Crecimiento ultimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xl font-bold text-green-600">+{data.growth.newAgencies30d}</p>
              <p className="text-xs text-muted-foreground">Agencias</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xl font-bold text-blue-600">+{data.growth.newUsers30d}</p>
              <p className="text-xs text-muted-foreground">Usuarios</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xl font-bold text-orange-600">+{data.growth.newTasks30d}</p>
              <p className="text-xs text-muted-foreground">Tareas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tasks by status */}
        {data.tasksByStatus.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tareas por estado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.tasksByStatus.map((item) => (
                  <div key={item.status} className="flex items-center justify-between">
                    <Badge
                      variant="secondary"
                      className={TASK_STATUS_COLORS[item.status as keyof typeof TASK_STATUS_COLORS] || ""}
                    >
                      {TASK_STATUS_LABELS[item.status as keyof typeof TASK_STATUS_LABELS] || item.status}
                    </Badge>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
                    <span className="text-sm font-medium w-20 capitalize">{item.plan}</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-14 text-right">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
