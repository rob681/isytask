import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@isytask/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const session = await getServerSession(authOptions);
      return createContext(
        session?.user
          ? {
              user: {
                id: (session.user as any).id,
                email: session.user.email!,
                name: session.user.name!,
                role: (session.user as any).role,
                clientProfileId: (session.user as any).clientProfileId,
                colaboradorProfileId: (session.user as any).colaboradorProfileId,
                permissions: (session.user as any).permissions ?? [],
              },
            }
          : null
      );
    },
  });

export { handler as GET, handler as POST };
