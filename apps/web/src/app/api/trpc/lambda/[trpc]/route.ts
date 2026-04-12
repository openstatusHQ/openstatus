import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

import { createOnError, guardTRPCSource } from "@/trpc/shared";
import { createTRPCContext } from "@openstatus/api";
import { lambdaRouter } from "@openstatus/api/src/lambda";

// Stripe is incompatible with Edge runtimes due to using Node.js events
// export const runtime = "edge";

const handler = (req: NextRequest) => {
  const blocked = guardTRPCSource(req);
  if (blocked) return blocked;

  return fetchRequestHandler({
    endpoint: "/api/trpc/lambda",
    router: lambdaRouter,
    req: req,
    createContext: () => createTRPCContext({ req }),
    onError: createOnError("lambda"),
  });
};

export { handler as GET, handler as POST };
