"use client";

import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { Building2, Users, ListTodo, Briefcase } from "lucide-react";
import { CardListSkeleton } from "@/components/ui/skeleton";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function AnalistaTendenciasPage() {
  const { data: trends, isLoading: trendsLoading } = trpc.platform.analistaMonthlyTrends.useQuery({});
  const { data: topAgencies, isLoading: topLoading } = trpc.platform.analistaTopAgencies.useQuery({});

  const isLoading = trendsLoading || topLoading;

  return (
    <>
      <Topbar title="Tendencias — Analitica" />
      <div className="p-4 md:p-6 space-y-6">
        {isLoading ? (
          <CardListSkeleton cards={2} />
        ) : (
          <>
            {/* Monthly trends */}
            {trends && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tendencias mensuales {new Date().getFullYear()}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-muted-foreground">Mes</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Agencias</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Usuarios</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Tareas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trends.map((m) => {
                          const hasData = m.agencies > 0 || m.users > 0 || m.tasks > 0;
                          if (!hasData && m.month > new Date().getMonth() + 1) return null;
                          return (
                            <tr key={m.month} className="border-b last:border-0">
                              <td className="py-2 font-medium">{MONTH_NAMES[m.month - 1]}</td>
                              <td className="py-2 text-right">
                                {m.agencies > 0 && (
                                  <span className="text-green-600 font-medium">+{m.agencies}</span>
                                )}
                                {m.agencies === 0 && <span className="text-muted-foreground">0</span>}
                              </td>
                              <td className="py-2 text-right">
                                {m.users > 0 && (
                                  <span className="text-blue-600 font-medium">+{m.users}</span>
                                )}
                                {m.users === 0 && <span className="text-muted-foreground">0</span>}
                              </td>
                              <td className="py-2 text-right">
                                {m.tasks > 0 && (
                                  <span className="text-orange-600 font-medium">+{m.tasks}</span>
                                )}
                                {m.tasks === 0 && <span className="text-muted-foreground">0</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top agencies */}
            {topAgencies && topAgencies.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top agencias por uso</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topAgencies.map((agency, idx) => (
                      <div
                        key={agency.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground w-6">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-medium text-sm">{agency.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{agency.planTier}</p>
                          </div>
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
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
