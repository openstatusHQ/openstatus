import { createTRPCProxyClient, loggerLink } from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "@openstatus/api";

import { endingLink } from "./shared";

export const api = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
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
});

export { type RouterInputs, type RouterOutputs } from "@openstatus/api";
