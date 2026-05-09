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
  CheckCircle2,
  PlayCircle,
  Send,
  Lock,
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

  const utils = trpc.useUtils();
  const { data: project, isLoading, error } = trpc.isyweb.getById.useQuery({ id });
  const { data: rounds = [] } = trpc.isyweb.revisionHistory.useQuery({ projectId: id });
  const startWorking = trpc.isyweb.startWorkingRevision.useMutation({
    onSuccess: () => {
      utils.isyweb.revisionHistory.invalidate({ projectId: id });
      utils.isyweb.getById.invalidate({ id });
    },
  });
  const resolveRev = trpc.isyweb.resolveRevision.useMutation({
    onSuccess: () => {
      utils.isyweb.revisionHistory.invalidate({ projectId: id });
      utils.isyweb.getById.invalidate({ id });
    },
  });

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

        {/* Rounds timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Rondas de revisión
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rounds.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Sin rondas todavía.
              </p>
            ) : (
              <div className="space-y-3">
                {rounds.map((r: any) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between border rounded-lg p-3 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          r.status === "APPROVED"
                            ? "bg-emerald-500"
                            : r.status === "RESOLVED"
                            ? "bg-purple-500"
                            : r.status === "IN_PROGRESS"
                            ? "bg-blue-500"
                            : r.status === "SUBMITTED"
                            ? "bg-amber-500"
                            : "bg-gray-400"
                        }`}
                      >
                        R{r.roundNumber}
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          Ronda {r.roundNumber}{" "}
                          <Badge variant="outline" className="ml-1 text-xs">
                            {r.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r._count?.annotations ?? 0} anotaciones ·{" "}
                          {r.submittedAt
                            ? `enviada ${new Date(r.submittedAt).toLocaleDateString()}`
                            : "no enviada aún"}
                          {r.approvedAt && ` · aprobada ${new Date(r.approvedAt).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {r.status === "SUBMITTED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startWorking.mutate({ revisionId: r.id })}
                          disabled={startWorking.isPending}
                        >
                          <PlayCircle className="h-4 w-4 mr-1" />
                          Empezar a trabajar
                        </Button>
                      )}
                      {r.status === "IN_PROGRESS" && (
                        <Button
                          size="sm"
                          onClick={() => resolveRev.mutate({ revisionId: r.id })}
                          disabled={resolveRev.isPending}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Notificar al cliente
                        </Button>
                      )}
                      {r.status === "APPROVED" && (
                        <Lock className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
