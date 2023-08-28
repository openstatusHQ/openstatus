import type { NextRequest } from "next/server";
import { H, Handlers } from "@highlight-run/node";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createTRPCContext } from "@openstatus/api";
import { lambdaRouter } from "@openstatus/api/src/lambda";

import { env } from "@/env";

// Stripe is incompatible with Edge runtimes due to using Node.js events
// export const runtime = "edge";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc/lambda",
    router: lambdaRouter,
    req: req,
    createContext: () => createTRPCContext({ req }),
    onError: ({ error, req }) => {
      console.error("Error in tRPC handler (lambda)");
      console.error(error);
      H.init({ projectID: env.NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID });
      const parsedHeaders = H.parseHeaders(Object.fromEntries(req.headers));
      Handlers.trpcOnError(
        {
          error,
          req: {
            headers: parsedHeaders,
          },
        },
        {
          projectID: env.NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID,
        },
      );
    },
  });

export { handler as GET, handler as POST };
