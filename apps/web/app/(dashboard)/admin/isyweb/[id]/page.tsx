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
  ExternalLink,
  Pencil,
  Globe,
  Code,
  Clock,
  ListTodo,
  Image as ImageIcon,
  Users,
} from "lucide-react";
import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Borrador", cls: "bg-gray-100 text-gray-700" },
  BROCHURE: { label: "Brochure", cls: "bg-amber-100 text-amber-700" },
  IN_DEVELOPMENT: { label: "En desarrollo", cls: "bg-blue-100 text-blue-700" },
  IN_REVIEW: { label: "En revisión", cls: "bg-purple-100 text-purple-700" },
  APPROVED: { label: "Aprobado", cls: "bg-emerald-100 text-emerald-700" },
  ARCHIVED: { label: "Archivado", cls: "bg-gray-100 text-gray-500" },
};

export default function IsywebProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data: project, isLoading, error } = trpc.isyweb.getById.useQuery({ id });

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
          <p className="text-red-600">{error?.message ?? "Proyecto no encontrado"}</p>
          <Button variant="outline" onClick={() => router.push("/admin/isyweb")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
        </div>
      </>
    );
  }

  const statusInfo = STATUS_LABELS[project.status];
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://isytask-web.vercel.app";
  const widgetSnippet = `<script>
  (function(){
    var s = document.createElement('script');
    s.src = '${baseUrl}/api/isyweb-widget?project=${project.widgetApiKey}';
    s.async = true;
    document.head.appendChild(s);
  })();
</script>`;

  return (
    <>
      <Topbar title={project.name} />

      <div className="p-6 space-y-6">
        <Button variant="ghost" onClick={() => router.push("/admin/isyweb")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a proyectos
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground mt-1">{project.description}</p>
            )}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge className={statusInfo.cls}>{statusInfo.label}</Badge>
              <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Ronda {project.currentRound}/{project.maxRevisionRounds}
              </span>
              {project.siteType && (
                <span className="text-sm text-muted-foreground">· {project.siteType}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {project.devUrl && (
              <Button variant="outline" asChild>
                <a href={project.devUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Abrir sitio dev
                </a>
              </Button>
            )}
            <Button asChild>
              <Link href={`/admin/isyweb/${project.id}/revisar`}>
                <Pencil className="h-4 w-4 mr-1" />
                Revisar sitio
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* URLs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4" />
                URLs del sitio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Desarrollo</p>
                {project.devUrl ? (
                  <a
                    href={project.devUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline break-all inline-flex items-center gap-1"
                  >
                    {project.devUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-muted-foreground italic">No configurada</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Producción</p>
                {project.productionUrl ? (
                  <a
                    href={project.productionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline break-all inline-flex items-center gap-1"
                  >
                    {project.productionUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-muted-foreground italic">No configurada</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Método de embed</p>
                <Badge variant="outline">{project.embedMethod}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Pages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListTodo className="h-4 w-4" />
                Páginas del sitio
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.pages.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Aún no hay páginas. El cliente las definirá en el brochure.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {project.pages.map((p: any) => (
                    <li key={p.id} className="flex items-center justify-between">
                      <span>{p.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {p.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Activity summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Actividad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Anotaciones totales</span>
                <span className="font-medium">{project._count?.annotations ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rondas completadas</span>
                <span className="font-medium">
                  {project.revisions.filter((r: any) => r.status === "APPROVED").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Colaboradores asignados</span>
                <span className="font-medium">{project.assignments.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assets subidos</span>
                <span className="font-medium">{project.assets.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Embed snippet */}
        {project.embedMethod === "SCRIPT" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Code className="h-4 w-4" />
                Snippet de instalación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Pega este código en el <code>&lt;head&gt;</code> del sitio en
                desarrollo para activar el modo de revisión.
              </p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                <code>{widgetSnippet}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => navigator.clipboard.writeText(widgetSnippet)}
              >
                Copiar snippet
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
