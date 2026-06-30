import { createTRPCContext } from "@openstatus/api";
import { edgeRouter } from "@openstatus/api/src/edge";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

import { auth } from "../../../../../lib/auth";
import { createOnError, guardTRPCSource } from "../../../../../lib/trpc/shared";

export const runtime = "edge";

const handler = (req: NextRequest) => {
  const blocked = guardTRPCSource(req);
  if (blocked) return blocked;

  return fetchRequestHandler({
    endpoint: "/api/trpc/edge",
    router: edgeRouter,
    req: req,
    createContext: () => createTRPCContext({ req, auth }),
    onError: createOnError("edge"),
  });
};

export { handler as GET, handler as POST };
