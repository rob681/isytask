"use client";

import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Building2, Users, ListTodo, Briefcase, ArrowRight } from "lucide-react";
import Link from "next/link";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@isytask/shared";
import { CardListSkeleton } from "@/components/ui/skeleton";

export default function SuperAdminDashboard() {
  const { data: stats, isLoading } = trpc.agencies.platformStats.useQuery();

  return (
    <>
      <Topbar title="Panel de Plataforma" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Summary cards */}
        {isLoading ? (
          <CardListSkeleton cards={4} />
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.totalAgencies}</p>
                      <p className="text-xs text-muted-foreground">Agencias totales</p>
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
                      <p className="text-2xl font-bold">{stats.activeAgencies}</p>
                      <p className="text-xs text-muted-foreground">Agencias activas</p>
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
                      <p className="text-2xl font-bold">{stats.totalUsers}</p>
                      <p className="text-xs text-muted-foreground">Usuarios totales</p>
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
                      <p className="text-2xl font-bold">{stats.totalTasks}</p>
                      <p className="text-xs text-muted-foreground">Tareas totales</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tasks by status */}
            {stats.tasksByStatus.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tareas por estado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {stats.tasksByStatus.map((item) => (
                      <div key={item.status} className="flex items-center gap-2">
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

            {/* Top agencies */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Agencias</CardTitle>
                <Link
                  href="/superadmin/agencias"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Ver todas <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent>
                {stats.topAgencies.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay agencias todavía
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stats.topAgencies.map((agency) => (
                      <Link
                        key={agency.id}
                        href={`/superadmin/agencias/${agency.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm">{agency.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {agency.slug} &middot; {agency.planTier}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> {agency._count.users}
                          </span>
                          <span className="flex items-center gap-1">
                            <ListTodo className="h-3 w-3" /> {agency._count.tasks}
                          </span>
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" /> {agency._count.services}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
