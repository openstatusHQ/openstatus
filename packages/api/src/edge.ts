import { domainRouter } from "./router/domain";
import { integrationRouter } from "./router/integration";
import { monitorRouter } from "./router/monitor";
import { notificationRouter } from "./router/notification";
import { pageRouter } from "./router/page";
import { statusReportRouter } from "./router/statusReport";
import { userRouter } from "./router/user";
import { workspaceRouter } from "./router/workspace";
import { createTRPCRouter } from "./trpc";

// Deployed to /trpc/edge/**
export const edgeRouter = createTRPCRouter({
  workspace: workspaceRouter,
  monitor: monitorRouter,
  page: pageRouter,
  incident: statusReportRouter,
  domain: domainRouter,
  integration: integrationRouter,
  user: userRouter,
  notification: notificationRouter,
});
