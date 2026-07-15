import type { AppRouter } from "@openstatus/api";
import * as Sentry from "@sentry/nextjs";
import { createTRPCClient, loggerLink } from "@trpc/client";
import { headers } from "next/headers";

import { endingLink } from "./shared";

export const api = createTRPCClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === "development" ||
        (opts.direction === "down" && opts.result instanceof Error),
      // Report the real error to Sentry directly instead of letting
      // captureConsoleIntegration scrape tRPC's styled console.error format string.
      logger: (opts) => {
        if (opts.direction === "down" && opts.result instanceof Error) {
          Sentry.captureException(opts.result, {
            extra: { path: opts.path, input: opts.input },
          });
          return;
        }
        if (process.env.NODE_ENV === "development") {
          console.log(opts);
        }
      },
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
