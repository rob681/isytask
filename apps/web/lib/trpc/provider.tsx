"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { trpc } from "./client";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error: any) => {
              // Don't retry on auth errors
              if (error?.data?.code === "UNAUTHORIZED") return false;
              if (error?.data?.code === "FORBIDDEN") return false;
              return failureCount < 2;
            },
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        httpBatchLink({
          url: "/api/trpc",
          fetch: async (url, options) => {
            const res = await fetch(url, options);

            // If the server returned HTML instead of JSON (e.g. session expired,
            // server error page), convert it to a proper JSON error so tRPC
            // doesn't crash with "Unexpected token '<'"
            const contentType = res.headers.get("content-type") ?? "";
            if (!res.ok && !contentType.includes("application/json")) {
              // Session expired → redirect to login
              if (res.status === 401 || res.redirected) {
                window.location.href = "/login";
                // Return a well-formed tRPC error response so the client doesn't throw a parse error
                return new Response(
                  JSON.stringify([{ error: { message: "Sesión expirada. Redirigiendo al login...", code: -32001, data: { code: "UNAUTHORIZED" } } }]),
                  { status: 401, headers: { "content-type": "application/json" } }
                );
              }

              console.error(`[tRPC] Server returned ${res.status} with non-JSON response`);
              return new Response(
                JSON.stringify([{ error: { message: "Error del servidor. Intenta de nuevo.", code: -32603, data: { code: "INTERNAL_SERVER_ERROR" } } }]),
                { status: res.status, headers: { "content-type": "application/json" } }
              );
            }

            return res;
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
