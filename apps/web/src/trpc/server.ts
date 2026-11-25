import type { AppRouter } from "@openstatus/api";
import { createTRPCClient } from "@trpc/client";
import { headers } from "next/headers";

import { endingLink, sentryLoggerLink } from "./shared";

export const api = createTRPCClient<AppRouter>({
  links: [
    sentryLoggerLink(),
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
