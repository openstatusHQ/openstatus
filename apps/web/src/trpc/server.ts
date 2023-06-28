"use server";

import { headers } from "next/headers";
import { loggerLink } from "@trpc/client";
import { experimental_createTRPCNextAppDirServer } from "@trpc/next/app-dir/server";
import superjson from "superjson";

import type { AppRouter } from "@openstatus/api";

import { endingLink } from "./shared";

export const api = experimental_createTRPCNextAppDirServer<AppRouter>({
  config() {
    return {
      transformer: superjson,
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        endingLink({
          headers: Object.fromEntries(headers().entries()),
        }),
      ],
    };
  },
});

export { type RouterInputs, type RouterOutputs } from "@openstatus/api";
