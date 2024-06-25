import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

import { createTRPCContext } from "@openstatus/api";
import { lambdaRouter } from "@openstatus/api/src/lambda";

// Stripe is incompatible with Edge runtimes due to using Node.js events
// export const runtime = "edge";

// We should understand why some requests are taking longer than 15s
export const maxDuration = 120;

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc/lambda",
    router: lambdaRouter,
    req: req,
    // @ts-expect-error
    createContext: () => createTRPCContext({ req }),
    onError: ({ error }) => {
      console.log("Error in tRPC handler (lambda)");
      console.error(error);
    },
  });

export { handler as GET, handler as POST };
