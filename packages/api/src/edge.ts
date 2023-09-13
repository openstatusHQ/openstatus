import { domainRouter } from "./router/domain";
import { incidentRouter } from "./router/incident";
import { integrationRouter } from "./router/integration";
import { monitorRouter } from "./router/monitor";
import { pageRouter } from "./router/page";
import { workspaceRouter } from "./router/workspace";
import { createTRPCRouter } from "./trpc";

// Deployed to /trpc/edge/**
export const edgeRouter = createTRPCRouter({
  workspace: workspaceRouter,
  monitor: monitorRouter,
  page: pageRouter,
  incident: incidentRouter,
  domain: domainRouter,
  integration: integrationRouter,
});
