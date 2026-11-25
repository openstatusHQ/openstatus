import { statusPageRouter } from "./router/statusPage";
import { createTRPCRouter } from "./trpc";

// The only procedures the public status-page app serves over HTTP.
export const statusPageAppRouter = createTRPCRouter({
  statusPage: statusPageRouter,
});
export type StatusPageAppRouter = typeof statusPageAppRouter;
