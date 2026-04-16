/**
 * Signed URL Generator — GET /api/file-url?path=attachments/task-123/file.pdf
 *
 * Returns a time-limited signed URL for private Supabase Storage files.
 * Only accessible to authenticated users who belong to the same agency as the task.
 *
 * The "attachments" bucket remains PRIVATE in Supabase — files are never
 * accessible without a valid signed URL.
 * The "images" bucket can remain public (avatars, logos — no sensitive data).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSignedUrl } from "@isytask/api";

// Signed URLs expire in 1 hour — enough for a working session
const EXPIRES_IN_SECONDS = 60 * 60;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const storagePath = req.nextUrl.searchParams.get("path");
  if (!storagePath) {
    return NextResponse.json({ error: "path es requerido" }, { status: 400 });
  }

  // Security: only allow access to "attachments" and "images" buckets
  const allowedBuckets = ["attachments", "images"];
  const bucket = storagePath.split("/")[0];
  if (!allowedBuckets.includes(bucket)) {
    return NextResponse.json({ error: "Bucket no permitido" }, { status: 403 });
  }

  // Security: prevent path traversal
  if (storagePath.includes("..") || storagePath.includes("//")) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }

  try {
    const signedUrl = await getSignedUrl(storagePath, EXPIRES_IN_SECONDS);

    return NextResponse.json(
      { url: signedUrl, expiresIn: EXPIRES_IN_SECONDS },
      {
        headers: {
          // Cache the signed URL for 55 minutes on the client
          "Cache-Control": "private, max-age=3300",
        },
      }
    );
  } catch (error) {
    console.error("[File URL] Error generating signed URL:", error);
    return NextResponse.json(
      { error: "No se pudo generar el enlace" },
      { status: 500 }
    );
  }
}
