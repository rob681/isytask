"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  Plus,
  Pencil,
  ExternalLink,
  Globe,
  ListTodo,
  MessageSquare,
  Clock,
  X,
  ChevronRight,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CardListSkeleton } from "@/components/ui/skeleton";

const SITE_TYPES = [
  { value: "LANDING", label: "Landing page" },
  { value: "ONE_PAGE", label: "One page" },
  { value: "MULTI_PAGE", label: "Multi-página" },
  { value: "ECOMMERCE", label: "E-commerce" },
  { value: "WEBAPP", label: "Web app" },
  { value: "BLOG", label: "Blog" },
  { value: "OTHER", label: "Otro" },
] as const;

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Borrador", cls: "bg-gray-100 text-gray-700" },
  BROCHURE: { label: "Brochure", cls: "bg-amber-100 text-amber-700" },
  IN_DEVELOPMENT: {
    label: "En desarrollo",
    cls: "bg-blue-100 text-blue-700",
  },
  IN_REVIEW: { label: "En revisión", cls: "bg-purple-100 text-purple-700" },
  APPROVED: { label: "Aprobado", cls: "bg-emerald-100 text-emerald-700" },
  ARCHIVED: { label: "Archivado", cls: "bg-gray-100 text-gray-500" },
};

const createSchema = z.object({
  clientId: z.string().min(1, "Selecciona un cliente"),
  name: z.string().min(2, "Mínimo 2 caracteres").max(120),
  description: z.string().max(2000).optional(),
  siteType: z
    .enum(["LANDING", "ONE_PAGE", "MULTI_PAGE", "ECOMMERCE", "WEBAPP", "BLOG", "OTHER"])
    .optional(),
  devUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  maxRevisionRounds: z.coerce.number().int().min(1).max(20).default(3),
});

type CreateForm = z.infer<typeof createSchema>;

export default function IsywebProjectsPage() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const utils = trpc.useUtils();

  // Page-level gate — if agency has no Isyweb subscription, show upsell
  const { data: access, isLoading: accessLoading } =
    trpc.ecosystem.getMyAccess.useQuery();
  const hasAccess = !!access?.isyweb;

  const { data: projects, isLoading } = trpc.isyweb.list.useQuery(undefined, {
    enabled: hasAccess,
  });
  const { data: stats } = trpc.isyweb.stats.useQuery(undefined, {
    enabled: hasAccess,
  });
  const { data: clientsData } = trpc.clients.list.useQuery({}, { enabled: hasAccess });

  const createMutation = trpc.isyweb.create.useMutation({
    onSuccess: (project) => {
      utils.isyweb.list.invalidate();
      utils.isyweb.stats.invalidate();
      setShowForm(false);
      reset();
      router.push(`/admin/isyweb/${project.id}`);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { maxRevisionRounds: 3 },
  });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({
      ...data,
      devUrl: data.devUrl || undefined,
    });
  };

  // Upsell when no access
  if (!accessLoading && !hasAccess) {
    return (
      <>
        <Topbar title="Isyweb" />
        <div className="p-6 max-w-3xl mx-auto">
          <Card className="border-2 border-dashed border-blue-300 bg-blue-50/30">
            <CardContent className="p-10 text-center">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-blue-100 flex items-center justify-center mb-5">
                <Pencil className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Isyweb no está activo</h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Isyweb es un addon que te permite ofrecer revisión visual de sitios
                web a tus clientes — postits sobre el sitio, brochure con IA, rondas
                de revisión y aprobación legal con timestamp.
              </p>
              <Button onClick={() => router.push("/admin/billing")}>
                Activar Isyweb (14 días gratis)
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Isyweb" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total" value={stats?.total ?? 0} icon={<Globe className="h-5 w-5" />} />
          <StatCard label="En desarrollo" value={stats?.inDev ?? 0} icon={<Pencil className="h-5 w-5" />} accent="blue" />
          <StatCard label="En revisión" value={stats?.inReview ?? 0} icon={<MessageSquare className="h-5 w-5" />} accent="purple" />
          <StatCard label="Aprobados" value={stats?.approved ?? 0} icon={<ListTodo className="h-5 w-5" />} accent="emerald" />
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Proyectos</h2>
          <Button onClick={() => setShowForm((s) => !s)}>
            {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {showForm ? "Cancelar" : "Nuevo proyecto"}
          </Button>
        </div>

        {/* Create form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Nuevo proyecto</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Cliente *</label>
                  <select
                    {...register("clientId")}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Selecciona…</option>
                    {((clientsData as any)?.clients ?? []).map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.user?.name ?? c.companyName ?? "Cliente"}
                      </option>
                    ))}
                  </select>
                  {errors.clientId && <p className="text-xs text-red-600 mt-1">{errors.clientId.message}</p>}
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Nombre del proyecto *</label>
                  <Input {...register("name")} placeholder="Sitio Cafetería Luna" />
                  {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium mb-1 block">Descripción</label>
                  <Input {...register("description")} placeholder="Sitio web institucional con menú y reservas" />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Tipo de sitio</label>
                  <select
                    {...register("siteType")}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">—</option>
                    {SITE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">URL de desarrollo</label>
                  <Input
                    {...register("devUrl")}
                    placeholder="https://staging.cliente.com"
                  />
                  {errors.devUrl && <p className="text-xs text-red-600 mt-1">{errors.devUrl.message}</p>}
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Rondas de revisión</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    {...register("maxRevisionRounds", { valueAsNumber: true })}
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
                    {createMutation.isPending ? "Creando…" : "Crear proyecto"}
                  </Button>
                </div>

                {createMutation.error && (
                  <p className="md:col-span-2 text-sm text-red-600">
                    {createMutation.error.message}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        {/* Project list */}
        {isLoading ? (
          <CardListSkeleton cards={3} />
        ) : !projects || projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No hay proyectos aún</p>
              <p className="text-sm mt-1">
                Crea el primero para empezar a recibir revisiones de tus clientes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p: any) => {
              const statusInfo = STATUS_LABELS[p.status];
              return (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/admin/isyweb/${p.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{p.name}</h3>
                        {p.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {p.description}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <Badge className={statusInfo.cls}>{statusInfo.label}</Badge>
                      <span className="text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Ronda {p.currentRound}/{p.maxRevisionRounds}
                      </span>
                    </div>

                    {p.devUrl && (
                      <a
                        href={p.devUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-3"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {p.devUrl}
                      </a>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3 pt-3 border-t">
                      <span>{p._count?.pages ?? 0} páginas</span>
                      <span>·</span>
                      <span>{p._count?.annotations ?? 0} anotaciones</span>
                      <span>·</span>
                      <span>{p._count?.revisions ?? 0} rondas</span>
                    </div>
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

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: "blue" | "purple" | "emerald";
}) {
  const accentMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  const cls = accent ? accentMap[accent] : "bg-gray-50 text-gray-600";
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${cls}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
