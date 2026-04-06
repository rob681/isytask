/**
 * SSO Token Generator — Isytask
 *
 * Creates a short-lived SSO token for navigating to Isysocial.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@isytask/db";
import {
  createSSOSession,
  getOrCreateOrganization,
} from "@isytask/api";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { email, name, role, agencyId, avatarUrl } = session.user as any;

  if (!agencyId) {
    return NextResponse.json({ error: "No agency context" }, { status: 400 });
  }

  try {
    const agency = await db.agency.findUniqueOrThrow({
      where: { id: agencyId },
      select: { name: true, stripeCustomerId: true },
    });

    const org = await getOrCreateOrganization(db, "ISYTASK", agencyId, agency.name, {
      stripeCustomerId: agency.stripeCustomerId ?? undefined,
    });

    const ssoSession = await createSSOSession(db, {
      organizationId: org.id,
      email,
      sourceApp: "ISYTASK",
      userName: name,
      userRole: role,
      userAvatarUrl: avatarUrl,
      ttlMinutes: 5,
    });

    const isysocialUrl = process.env.ISYSOCIAL_APP_URL || "https://www.isysocial.com";
    const redirectUrl = `${isysocialUrl}/api/sso/consume?token=${ssoSession.token}`;

    return NextResponse.json({ redirectUrl, token: ssoSession.token });
  } catch (error) {
    console.error("[SSO] Failed to generate token:", error);
    return NextResponse.json({ error: "Failed to generate SSO token" }, { status: 500 });
  }
}
