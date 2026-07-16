import { appRouter, createTRPCContext } from "@openstatus/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

import { auth } from "../../../../../lib/auth";
import { createOnError, guardTRPCSource } from "../../../../../lib/trpc/shared";

// Runs on the Node.js runtime (Vercel Fluid compute). The whole tRPC surface
// is served here — several routers pull Node-only deps (@slack/web-api, email
// and notification SDKs) that are not Edge-safe.

const handler = (req: NextRequest) => {
  const blocked = guardTRPCSource(req);
  if (blocked) return blocked;

  return fetchRequestHandler({
    endpoint: "/api/trpc/lambda",
    router: appRouter,
    req: req,
    createContext: () => createTRPCContext({ req, auth }),
    onError: createOnError("lambda"),
  });
};

export { handler as GET, handler as POST };
