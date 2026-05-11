"use client";

import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  Globe,
  Pencil,
  Clock,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { CardListSkeleton } from "@/components/ui/skeleton";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Borrador", cls: "bg-gray-100 text-gray-700" },
  BROCHURE: { label: "Brochure pendiente", cls: "bg-amber-100 text-amber-700" },
  IN_DEVELOPMENT: { label: "En desarrollo", cls: "bg-blue-100 text-blue-700" },
  IN_REVIEW: { label: "Listo para revisar", cls: "bg-purple-100 text-purple-700" },
  APPROVED: { label: "Aprobado", cls: "bg-emerald-100 text-emerald-700" },
  ARCHIVED: { label: "Archivado", cls: "bg-gray-100 text-gray-500" },
};

export default function ClienteIsywebPage() {
  const router = useRouter();
  const { data: access, isLoading: accessLoading } =
    trpc.ecosystem.getMyAccess.useQuery();
  const hasAccess = !!access?.isyweb;
  const { data: projects, isLoading } = trpc.isyweb.list.useQuery(undefined, {
    enabled: hasAccess,
  });

  if (!accessLoading && !hasAccess) {
    return (
      <>
        <Topbar title="Mis sitios web" />
        <div className="p-6 max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
              <h2 className="text-lg font-semibold mb-2">Módulo no disponible</h2>
              <p className="text-sm text-muted-foreground">
                Tu agencia aún no ha habilitado el módulo de revisión de sitios web
                para tu cuenta. Si necesitas acceso, contacta a tu agencia.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Mis sitios web" />

      <div className="p-6 space-y-6">
        {isLoading ? (
          <CardListSkeleton cards={2} />
        ) : !projects || projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No tienes proyectos activos</p>
              <p className="text-sm mt-1">
                Tu agencia te avisará cuando haya un sitio listo para revisar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p: any) => {
              const statusInfo = STATUS_LABELS[p.status];
              const canReview = p.status === "IN_REVIEW" || p.status === "IN_DEVELOPMENT";

              return (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/cliente/isyweb/${p.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate text-lg">{p.name}</h3>
                        {p.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {p.description}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <Badge className={statusInfo.cls}>{statusInfo.label}</Badge>
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Ronda {p.currentRound} de {p.maxRevisionRounds}
                      </span>
                    </div>

                    {canReview && p.devUrl && (
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                        <Pencil className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-600">
                          Revisar sitio →
                        </span>
                      </div>
                    )}

                    {p.status === "BROCHURE" && (
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                        <Pencil className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-600">
                          Completa el brochure →
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
