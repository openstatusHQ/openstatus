import { blobRouter } from "./router/blob";
import { checkerRouter } from "./router/checker";
import { domainRouter } from "./router/domain";
import { feedbackRouter } from "./router/feedback";
import { incidentRouter } from "./router/incident";
import { invitationRouter } from "./router/invitation";
import { maintenanceRouter } from "./router/maintenance";
import { memberRouter } from "./router/member";
import { monitorRouter } from "./router/monitor";
import { monitorTagRouter } from "./router/monitorTag";
import { notificationRouter } from "./router/notification";
import { pageRouter } from "./router/page";
import { pageComponentRouter } from "./router/pageComponent";
import { pageSubscriberRouter } from "./router/pageSubscriber";
import { privateLocationRouter } from "./router/privateLocation";
import { statusPageRouter } from "./router/statusPage";
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
  pageComponent: pageComponentRouter,
  statusReport: statusReportRouter,
  domain: domainRouter,
  user: userRouter,
  notification: notificationRouter,
  invitation: invitationRouter,
  incident: incidentRouter,
  pageSubscriber: pageSubscriberRouter,
  tinybird: tinybirdRouter,
  monitorTag: monitorTagRouter,
  maintenance: maintenanceRouter,
  member: memberRouter,
  checker: checkerRouter,
  blob: blobRouter,
  feedback: feedbackRouter,
  statusPage: statusPageRouter,
  privateLocation: privateLocationRouter,
});
