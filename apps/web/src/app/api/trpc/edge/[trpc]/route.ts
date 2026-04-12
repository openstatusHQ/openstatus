import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

import { guardTRPCSource } from "@/trpc/shared";
import { createTRPCContext } from "@openstatus/api";
import { edgeRouter } from "@openstatus/api/src/edge";

export const runtime = "edge";

const handler = (req: NextRequest) => {
  const blocked = guardTRPCSource(req);
  if (blocked) return blocked;

  return fetchRequestHandler({
    endpoint: "/api/trpc/edge",
    router: edgeRouter,
    req: req,
    createContext: () => createTRPCContext({ req }),
    onError: ({ error }) => {
      console.log("Error in tRPC handler (edge)");
      console.error(error);
    },
  });
};

export { handler as GET, handler as POST };
