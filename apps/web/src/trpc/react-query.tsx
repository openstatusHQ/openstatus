"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loggerLink } from "@trpc/client";
import type React from "react";
import { useState } from "react";
import { endingLink } from "./shared";

import type { AppRouter } from "@openstatus/api";
import { createTRPCReact } from "@trpc/react-query";
import SuperJSON from "superjson";

export const api = createTRPCReact<AppRouter>();

export function TRPCReactQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    api.createClient({
      transformer: SuperJSON,
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        endingLink({
          headers: {
            "x-trpc-source": "client",
          },
        }),
      ],
    }),
  );
  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
}
