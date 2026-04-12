import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@isytask/api";
import type { Session } from "@isytask/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.NEXTAUTH_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("NEXTAUTH_SECRET environment variable is required");
}

/** Extract session from Bearer token (mobile) or NextAuth cookie (web) */
async function resolveSession(req: Request): Promise<Session | null> {
  // 1. Check for Bearer token (mobile clients)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return {
        user: {
          id: decoded.id,
          email: decoded.email,
          name: decoded.name,
          role: decoded.role,
          agencyId: decoded.agencyId,
          clientProfileId: decoded.clientProfileId,
          colaboradorProfileId: decoded.colaboradorProfileId,
          permissions: decoded.permissions ?? [],
        },
      };
    } catch {
      // Invalid/expired token — fall through to NextAuth
    }
  }

  // 2. Fall back to NextAuth session (web clients)
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return {
      user: {
        id: (session.user as any).id,
        email: session.user.email!,
        name: session.user.name!,
        role: (session.user as any).role,
        ...((session.user as any).agencyId && {
          agencyId: (session.user as any).agencyId,
        }),
        clientProfileId: (session.user as any).clientProfileId,
        colaboradorProfileId: (session.user as any).colaboradorProfileId,
        permissions: (session.user as any).permissions ?? [],
      },
    };
  }

  return null;
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const session = await resolveSession(req);
      return createContext(session);
    },
    onError: ({ path, error }) => {
      console.error(`[tRPC] ${path ?? "unknown"}: ${error.message}`);
    },
  });

export { handler as GET, handler as POST };
