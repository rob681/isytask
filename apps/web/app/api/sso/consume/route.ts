/**
 * SSO Token Consumer — Isytask
 *
 * Verifies an SSO token from another product, finds or creates the user,
 * creates a NextAuth session, and redirects to the dashboard.
 *
 * This endpoint is called when a user clicks "Go to Isytask" from Isysocial.
 */

import { NextResponse } from "next/server";
import { db } from "@isytask/db";
import { consumeSSOSession } from "@isytask/api";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_sso_token", req.url));
  }

  try {
    // Consume the one-time SSO token
    const ssoSession = await consumeSSOSession(db, token);

    if (!ssoSession) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_or_expired_sso_token", req.url)
      );
    }

    // Find the organization and its Isytask agency
    const org = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM shared.organizations WHERE id = $1`,
      ssoSession.organization_id
    );

    if (!org[0]?.isytask_agency_id) {
      return NextResponse.redirect(
        new URL("/login?error=no_isytask_account", req.url)
      );
    }

    const agencyId = org[0].isytask_agency_id;

    // Find user in Isytask by email + agency
    let user = await db.user.findFirst({
      where: {
        email: ssoSession.email,
        agencyId,
        isActive: true,
      },
      include: {
        clientProfile: { select: { id: true } },
        colaboradorProfile: { select: { id: true } },
      },
    });

    if (!user) {
      // User exists in Isysocial but not in Isytask
      // Redirect to login with a helpful message
      return NextResponse.redirect(
        new URL(
          `/login?error=no_isytask_user&email=${encodeURIComponent(ssoSession.email)}`,
          req.url
        )
      );
    }

    // Create a NextAuth-compatible JWT token
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.redirect(new URL("/login?error=server_config", req.url));
    }

    const jwtPayload = {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      agencyId: user.agencyId,
      clientProfileId: user.clientProfile?.id ?? null,
      colaboradorProfileId: user.colaboradorProfile?.id ?? null,
      permissions: (user.colaboradorProfile as any)?.permissions ?? [],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
    };

    const sessionToken = jwt.sign(jwtPayload, secret, { algorithm: "HS256" });

    // Set the NextAuth session cookie
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const isSecure = baseUrl.startsWith("https");
    const cookieName = isSecure
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    const cookieStore = await cookies();
    cookieStore.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Redirect to appropriate dashboard based on role
    const dashboardMap: Record<string, string> = {
      SUPER_ADMIN: "/superadmin",
      ADMIN: "/admin",
      COLABORADOR: "/equipo",
      CLIENTE: "/cliente",
    };

    const dashboardPath = dashboardMap[user.role] || "/admin";
    return NextResponse.redirect(new URL(dashboardPath, baseUrl));
  } catch (error) {
    console.error("[SSO] Failed to consume token:", error);
    return NextResponse.redirect(new URL("/login?error=sso_failed", req.url));
  }
}
