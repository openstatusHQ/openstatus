import type { AppRouter } from "@openstatus/api";
import { createTRPCClient } from "@trpc/client";

import { endingLink, sentryLoggerLink } from "./shared";

export const api = createTRPCClient<AppRouter>({
  links: [
    sentryLoggerLink(),
    endingLink({
      headers: {
        "x-trpc-source": "client",
      },
    }),
  ],
});

export { type RouterInputs, type RouterOutputs } from "@openstatus/api";
