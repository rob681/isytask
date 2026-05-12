import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";

/**
 * Tier 2 proxy passthrough.
 *
 * GET /api/isyweb-proxy?projectId=X&viewport=DESKTOP
 *
 * 1. Verify auth + project access
 * 2. Forward to apps/proxy-isyweb /proxy with bearer auth
 * 3. Stream HTML back to the caller (the iframe in ReviewEditor will load this URL)
 *
 * Requires env vars:
 *   PROXY_ISYWEB_URL     — e.g. "https://isyweb-proxy.railway.app"
 *   PROXY_SHARED_SECRET  — same value as on the proxy server
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
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!PROXY_URL || !PROXY_SECRET) {
    return new NextResponse(
      "Proxy not configured — set PROXY_ISYWEB_URL and PROXY_SHARED_SECRET in the Next.js env",
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

  // Validate access
  const project = await db().isywebProject.findUnique({
    where: { id: projectId },
    select: { id: true, agencyId: true, clientId: true, devUrl: true, widgetApiKey: true },
  });
  if (!project || !project.devUrl) {
    return new NextResponse("Project not found or no devUrl set", { status: 404 });
  }
  const userAgencyId = (session.user as any).agencyId;
  const role = (session.user as any).role;
  if (
    project.agencyId !== userAgencyId &&
    !["SUPER_ADMIN", "SOPORTE"].includes(role)
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (role === "CLIENTE") {
    const cp = await db().clientProfile.findUnique({
      where: { userId: (session.user as any).id },
      select: { id: true, isywebEnabled: true },
    });
    if (!cp?.isywebEnabled || project.clientId !== cp.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // Forward to proxy server
  try {
    const upstream = await fetch(`${PROXY_URL}/proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PROXY_SECRET}`,
      },
      body: JSON.stringify({
        url: project.devUrl,
        projectKey: project.widgetApiKey,
        viewport,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      return new NextResponse(
        `Proxy upstream error (${upstream.status}): ${errText.slice(0, 500)}`,
        { status: 502 }
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        // We strip frame-blocking headers — that's the whole point of this proxy
      },
    });
  } catch (e: any) {
    return new NextResponse(`Proxy fetch failed: ${e?.message ?? e}`, { status: 502 });
  }
}
