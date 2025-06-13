import { appRouter } from "@/server/routers/app";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    // createContext: () => ({ ... })
  });
}
export { handler as GET, handler as POST };
