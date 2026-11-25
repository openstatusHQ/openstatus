import { statusPageAppRouter } from "@openstatus/api/src/status-page";
import { createTRPCContext } from "@openstatus/api/src/trpc";
import { createTRPCOnError } from "@openstatus/api/src/trpc-errors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

import { auth } from "../../../../../lib/auth";
import { guardTRPCSource } from "../../../../../lib/trpc/shared";

// Only the statusPage router is mounted: this app is public, so dashboard
// procedures must not be reachable from it.

const handler = (req: NextRequest) => {
  const blocked = guardTRPCSource(req);
  if (blocked) return blocked;

  return fetchRequestHandler({
    endpoint: "/api/trpc/lambda",
    router: statusPageAppRouter,
    req: req,
    createContext: () => createTRPCContext({ req, viewerAuth: auth }),
    onError: createTRPCOnError("lambda"),
  });
};

export { handler as GET, handler as POST };
