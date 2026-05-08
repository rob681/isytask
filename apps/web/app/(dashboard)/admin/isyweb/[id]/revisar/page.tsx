"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { ReviewEditor } from "@/components/isyweb/review-editor";

export default function AdminRevisarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: project, isLoading, error } = trpc.isyweb.getById.useQuery({ id });

  if (isLoading) return <div className="p-6">Cargando…</div>;
  if (error || !project) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error?.message ?? "No encontrado"}</p>
      </div>
    );
  }
  if (!project.devUrl) {
    return (
      <div className="p-6">
        <p>Configura primero la URL de desarrollo en el detalle del proyecto.</p>
      </div>
    );
  }

  return (
    <ReviewEditor
      projectId={project.id}
      projectName={project.name}
      devUrl={project.devUrl}
      onBack={() => router.push(`/admin/isyweb/${project.id}`)}
    />
  );
}
