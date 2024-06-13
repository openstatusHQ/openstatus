import { domainRouter } from "./router/domain";
import { incidentRouter } from "./router/incident";
import { integrationRouter } from "./router/integration";
import { invitationRouter } from "./router/invitation";
import { maintenanceRouter } from "./router/maintenance";
import { monitorRouter } from "./router/monitor";
import { monitorTagRouter } from "./router/monitorTag";
import { notificationRouter } from "./router/notification";
import { pageRouter } from "./router/page";
import { pageSubscriberRouter } from "./router/pageSubscriber";
import { statusReportRouter } from "./router/statusReport";
import { tinybirdRouter } from "./router/tinybird";
import { userRouter } from "./router/user";
import { workspaceRouter } from "./router/workspace";
import { createTRPCRouter } from "./trpc";

// Deployed to /trpc/edge/**
export const edgeRouter = createTRPCRouter({
  workspace: workspaceRouter,
  monitor: monitorRouter,
  page: pageRouter,
  statusReport: statusReportRouter,
  domain: domainRouter,
  integration: integrationRouter,
  user: userRouter,
  notification: notificationRouter,
  invitation: invitationRouter,
  incident: incidentRouter,
  pageSubscriber: pageSubscriberRouter,
  tinybird: tinybirdRouter,
  monitorTag: monitorTagRouter,
  maintenance: maintenanceRouter,
});
