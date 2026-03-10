import { appRouter, createContext } from "@isytask/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function createServerCaller() {
  const session = await getServerSession(authOptions);

  const ctx = createContext(
    session?.user
      ? {
          user: {
            id: (session.user as any).id,
            email: session.user.email!,
            name: session.user.name!,
            role: (session.user as any).role,
            agencyId: (session.user as any).agencyId,
            clientProfileId: (session.user as any).clientProfileId,
            colaboradorProfileId: (session.user as any).colaboradorProfileId,
          },
        }
      : null
  );

  return appRouter.createCaller(ctx);
}
