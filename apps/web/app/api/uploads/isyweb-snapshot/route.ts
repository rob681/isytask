import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@isytask/api";
import { PrismaClient } from "@/generated/prisma";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB — full-page screenshots can be larger than avatars

let _db: PrismaClient | null = null;
function db() {
  if (!_db) _db = new PrismaClient();
  return _db;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const revisionId = formData.get("revisionId") as string | null;
  const viewport = (formData.get("viewport") as string | null) ?? "DESKTOP";

  if (!file || !revisionId) {
    return NextResponse.json({ error: "Falta file o revisionId" }, { status: 400 });
  }
  if (file.type !== "image/jpeg" && file.type !== "image/png") {
    return NextResponse.json({ error: "Solo PNG o JPEG" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Snapshot excede 5MB" }, { status: 400 });
  }

  // Validate the user has access to the revision's project
  const revision = await db().isywebRevision.findUnique({
    where: { id: revisionId },
    include: { project: { select: { agencyId: true, clientId: true } } },
  });
  if (!revision) {
    return NextResponse.json({ error: "Revisión no encontrada" }, { status: 404 });
  }
  const userAgencyId = (session.user as any).agencyId;
  if (revision.project.agencyId !== userAgencyId && (session.user as any).role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `isyweb-snapshots/${revision.project.agencyId}/${revisionId}/${viewport.toLowerCase()}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { url } = await uploadFile("images", path, buffer, file.type);

  return NextResponse.json({ url, viewport, revisionId });
}
