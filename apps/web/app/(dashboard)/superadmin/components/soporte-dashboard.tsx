"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Building2, Users, UserX, ArrowRight } from "lucide-react";
import Link from "next/link";
import { CardListSkeleton } from "@/components/ui/skeleton";

export default function SoporteDashboard() {
  const { data, isLoading } = trpc.platform.soporteDashboard.useQuery();

  if (isLoading) return <CardListSkeleton cards={4} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.activeAgencies}</p>
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
                <p className="text-2xl font-bold">{data.totalUsers}</p>
                <p className="text-xs text-muted-foreground">Usuarios totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-600">
                <UserX className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.inactiveUsers}</p>
                <p className="text-xs text-muted-foreground">Usuarios inactivos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Actividad reciente</CardTitle>
          <Link
            href="/superadmin/soporte/agencias"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentAgencies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin actividad reciente</p>
          ) : (
            <div className="space-y-3">
              {data.recentAgencies.map((agency) => (
                <div
                  key={agency.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium text-sm">{agency.name}</p>
                    <p className="text-xs text-muted-foreground">{agency.slug}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={agency.isActive ? "default" : "secondary"}>
                      {agency.isActive ? "Activa" : "Inactiva"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {agency._count.users} usuarios · {agency._count.tasks} tareas
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
