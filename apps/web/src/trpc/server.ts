import { createTRPCClient, loggerLink } from "@trpc/client";
import { headers } from "next/headers";

import type { AppRouter } from "@openstatus/api";

import { endingLink } from "./shared";

export const api = createTRPCClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === "development" ||
        (opts.direction === "down" && opts.result instanceof Error),
    }),
    endingLink({
      headers: async () => {
        const h = new Map(await headers());
        h.delete("connection");
        h.delete("transfer-encoding");
        h.set("x-trpc-source", "server");
        return Object.fromEntries(h.entries());
      },
    }),
  ],
});

export { type RouterInputs, type RouterOutputs } from "@openstatus/api";
