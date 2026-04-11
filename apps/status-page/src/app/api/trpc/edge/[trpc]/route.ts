import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { createTRPCContext } from "@openstatus/api";
import { edgeRouter } from "@openstatus/api/src/edge";

export const runtime = "edge";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc/edge",
    router: edgeRouter,
    req: req,
    createContext: () => createTRPCContext({ req, auth }),
    onError: ({ error, path, input, type }) => {
      console.log("Error in tRPC handler (edge)");
      // TEMP: extra diagnostic context to trace malformed tRPC batch calls
      console.error({
        path,
        type,
        input,
        url: req.url,
        method: req.method,
        userAgent: req.headers.get("user-agent"),
        referer: req.headers.get("referer"),
        trpcSource: req.headers.get("x-trpc-source"),
        secFetchSite: req.headers.get("sec-fetch-site"),
        secFetchMode: req.headers.get("sec-fetch-mode"),
        secFetchDest: req.headers.get("sec-fetch-dest"),
      });
      console.error(error);
    },
  });

export { handler as GET, handler as POST };
