import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";

/**
 * Tier 3 screenshot passthrough.
 *
 * GET /api/isyweb-screenshot?projectId=X&viewport=DESKTOP
 *
 * Returns a fresh screenshot (image/jpeg) of the dev site at the given
 * viewport. The ReviewEditor uses this as the static background when
 * `embedMethod = SCREENSHOT` (Tier 3 last resort).
 */

let _db: PrismaClient | null = null;
function db() {
  if (!_db) _db = new PrismaClient();
  return _db;
}

const PROXY_URL = process.env.PROXY_ISYWEB_URL;
const PROXY_SECRET = process.env.PROXY_SHARED_SECRET;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (!PROXY_URL || !PROXY_SECRET) {
    return new NextResponse(
      "Proxy not configured — set PROXY_ISYWEB_URL and PROXY_SHARED_SECRET",
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const viewport = (searchParams.get("viewport") ?? "DESKTOP") as
    | "DESKTOP"
    | "TABLET"
    | "MOBILE";

  if (!projectId) return new NextResponse("Missing projectId", { status: 400 });

  const project = await db().isywebProject.findUnique({
    where: { id: projectId },
    select: { id: true, agencyId: true, clientId: true, devUrl: true },
  });
  if (!project || !project.devUrl) {
    return new NextResponse("Project not found or no devUrl", { status: 404 });
  }
  const userAgencyId = (session.user as any).agencyId;
  const role = (session.user as any).role;
  if (
    project.agencyId !== userAgencyId &&
    !["SUPER_ADMIN", "SOPORTE"].includes(role)
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const upstream = await fetch(`${PROXY_URL}/screenshot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PROXY_SECRET}`,
      },
      body: JSON.stringify({
        url: project.devUrl,
        viewport,
        fullPage: true,
        format: "jpeg",
        quality: 75,
      }),
    });
    if (!upstream.ok) {
      const t = await upstream.text().catch(() => "");
      return new NextResponse(`Screenshot failed: ${t.slice(0, 300)}`, { status: 502 });
    }
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e: any) {
    return new NextResponse(`Screenshot fetch failed: ${e?.message ?? e}`, { status: 502 });
  }
}
