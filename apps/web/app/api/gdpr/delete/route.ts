/**
 * GDPR Account Deletion — POST /api/gdpr/delete
 *
 * Soft-deletes the requesting user's account per GDPR Article 17 (right to erasure).
 *
 * Strategy:
 *  - Anonymizes PII fields (email, name, phone, avatarUrl)
 *  - Deletes tokens and push subscriptions
 *  - Marks account as inactive
 *  - Does NOT delete task records — they belong to the agency and may be needed for legal/accounting
 *  - Task comments are anonymized (content preserved, author set to "[Usuario eliminado]")
 *
 * Requires current password for confirmation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@isytask/db";
import { compare } from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;

  let body: { password: string; confirm: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  if (!body.password || body.confirm !== "ELIMINAR MI CUENTA") {
    return NextResponse.json(
      { error: "Debes confirmar escribiendo exactamente: ELIMINAR MI CUENTA" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, role: true },
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Cuenta inválida" }, { status: 400 });
  }

  const isValid = await compare(body.password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  // ADMIN accounts cannot self-delete — must be done by platform admin
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Las cuentas de administrador no pueden eliminarse de forma automática. Contacta al soporte." },
      { status: 403 }
    );
  }

  try {
    const anonymizedEmail = `deleted-${userId.slice(0, 8)}@isytask.deleted`;

    await db.$transaction([
      // 1. Anonymize PII
      db.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail,
          name: "[Usuario eliminado]",
          phone: null,
          avatarUrl: null,
          passwordHash: null,
          isActive: false,
          mfaEnabled: false,
          totpSecret: null,
        },
      }),
      // 2. Delete auth tokens
      db.token.deleteMany({ where: { userId } }),
      // 3. Delete push subscriptions
      db.pushSubscription.deleteMany({ where: { userId } }),
      // 4. Delete notifications (not needed once account is gone)
      db.notification.deleteMany({ where: { userId } }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Tu cuenta ha sido eliminada. Los datos de sesión serán eliminados en tu próximo logout.",
    });
  } catch (error) {
    console.error("[GDPR Delete] Error:", error);
    return NextResponse.json({ error: "Error interno al eliminar cuenta" }, { status: 500 });
  }
}
