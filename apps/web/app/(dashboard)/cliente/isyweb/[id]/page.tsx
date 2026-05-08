"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  ArrowLeft,
  Pencil,
  ClipboardList,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Clock,
} from "lucide-react";
import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Borrador", cls: "bg-gray-100 text-gray-700" },
  BROCHURE: { label: "Brochure pendiente", cls: "bg-amber-100 text-amber-700" },
  IN_DEVELOPMENT: { label: "En desarrollo", cls: "bg-blue-100 text-blue-700" },
  IN_REVIEW: { label: "Listo para revisar", cls: "bg-purple-100 text-purple-700" },
  APPROVED: { label: "Aprobado", cls: "bg-emerald-100 text-emerald-700" },
  ARCHIVED: { label: "Archivado", cls: "bg-gray-100 text-gray-500" },
};

export default function ClienteProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data: project, isLoading, error } = trpc.isyweb.getById.useQuery({ id });
  const { data: brochure } = trpc.isyweb.brochureGet.useQuery(
    { projectId: id },
    { enabled: !!project }
  );

  if (isLoading) {
    return (
      <>
        <Topbar title="Proyecto" />
        <div className="p-6">Cargando…</div>
      </>
    );
  }
  if (error || !project) {
    return (
      <>
        <Topbar title="Proyecto" />
        <div className="p-6">
          <p className="text-red-600">{error?.message ?? "No encontrado"}</p>
          <Button variant="outline" onClick={() => router.push("/cliente/isyweb")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
        </div>
      </>
    );
  }

  const statusInfo = STATUS_LABELS[project.status];
  const brochureStarted = !!brochure?.session;
  const brochureCompleted = brochure?.session?.status === "completed";
  const fieldsCount = brochure?.session?.fields?.length ?? 0;
  const totalRequired = (brochure?.fieldDefs ?? []).filter(
    (f: any) => f.required
  ).length;

  return (
    <>
      <Topbar title={project.name} />
      <div className="p-6 space-y-6">
        <Button variant="ghost" onClick={() => router.push("/cliente/isyweb")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a mis sitios
        </Button>

        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground mt-1">{project.description}</p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <Badge className={statusInfo.cls}>{statusInfo.label}</Badge>
            <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Ronda {project.currentRound}/{project.maxRevisionRounds}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Brochure card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {brochureCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <ClipboardList className="h-5 w-5" />
                )}
                Brochure del proyecto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {brochureCompleted ? (
                <div>
                  <p className="text-sm text-emerald-700 font-medium">
                    ✓ Brochure completado
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fieldsCount} campos llenos. Tu agencia ya tiene la información.
                  </p>
                </div>
              ) : brochureStarted ? (
                <div>
                  <p className="text-sm">
                    En progreso — {fieldsCount} de ~{totalRequired} campos requeridos
                  </p>
                  <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          (fieldsCount / Math.max(totalRequired, 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Antes de empezar, llenemos un brochure con la información de tu sitio.
                  Puedes hacerlo con ayuda de IA o llenarlo tú mismo.
                </p>
              )}

              <Button asChild className="w-full">
                <Link href={`/cliente/isyweb/${project.id}/brochure`}>
                  {brochureCompleted ? (
                    <>Ver brochure</>
                  ) : brochureStarted ? (
                    <>Continuar brochure</>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" />
                      Empezar brochure
                    </>
                  )}
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Review card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Pencil className="h-5 w-5" />
                Revisión del sitio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!project.devUrl ? (
                <p className="text-sm text-muted-foreground">
                  Tu agencia aún no ha publicado el sitio en desarrollo. Te avisaremos
                  cuando esté listo para revisar.
                </p>
              ) : project.status === "IN_REVIEW" || project.status === "IN_DEVELOPMENT" ? (
                <>
                  <p className="text-sm">
                    Tu sitio está en{" "}
                    <a
                      href={project.devUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      {project.devUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                  <Button asChild className="w-full">
                    <Link href={`/cliente/isyweb/${project.id}/revisar`}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Revisar y anotar
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  El proyecto está {statusInfo.label.toLowerCase()}.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
