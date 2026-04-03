import type { Interceptor } from "@connectrpc/connect";
import { getLogger } from "@logtape/logtape";
import {
  type EventProps,
  Events,
  parseInputToProps,
  setupAnalytics,
} from "@openstatus/analytics";

import { RPC_CONTEXT_KEY } from "./auth";

const logger = getLogger("api-server");

type RpcEventMapping = {
  event: EventProps;
  eventProps?: string[];
};

/**
 * Mapping from "ServiceTypeName/MethodName" to OpenPanel event + optional props.
 * Matches the same Events used by v1 REST trackMiddleware for parity.
 */
export const RPC_EVENT_MAP: Record<string, RpcEventMapping> = {
  // MonitorService
  "openstatus.monitor.v1.MonitorService/createHTTPMonitor": {
    event: Events.CreateMonitor,
    eventProps: ["url", "jobType"],
  },
  "openstatus.monitor.v1.MonitorService/createTCPMonitor": {
    event: Events.CreateMonitor,
    eventProps: ["url", "jobType"],
  },
  "openstatus.monitor.v1.MonitorService/createDNSMonitor": {
    event: Events.CreateMonitor,
    eventProps: ["url", "jobType"],
  },
  "openstatus.monitor.v1.MonitorService/updateHTTPMonitor": {
    event: Events.UpdateMonitor,
  },
  "openstatus.monitor.v1.MonitorService/updateTCPMonitor": {
    event: Events.UpdateMonitor,
  },
  "openstatus.monitor.v1.MonitorService/updateDNSMonitor": {
    event: Events.UpdateMonitor,
  },
  "openstatus.monitor.v1.MonitorService/deleteMonitor": {
    event: Events.DeleteMonitor,
  },

  // StatusReportService
  "openstatus.status_report.v1.StatusReportService/createStatusReport": {
    event: Events.CreateReport,
  },
  "openstatus.status_report.v1.StatusReportService/updateStatusReport": {
    event: Events.UpdateReport,
  },
  "openstatus.status_report.v1.StatusReportService/deleteStatusReport": {
    event: Events.DeleteReport,
  },
  "openstatus.status_report.v1.StatusReportService/addStatusReportUpdate": {
    event: Events.CreateReportUpdate,
  },

  // StatusPageService
  "openstatus.status_page.v1.StatusPageService/createStatusPage": {
    event: Events.CreatePage,
    eventProps: ["slug"],
  },
  "openstatus.status_page.v1.StatusPageService/updateStatusPage": {
    event: Events.UpdatePage,
  },
  "openstatus.status_page.v1.StatusPageService/deleteStatusPage": {
    event: Events.DeletePage,
  },
  "openstatus.status_page.v1.StatusPageService/subscribeToPage": {
    event: Events.SubscribePage,
  },

  // MaintenanceService
  "openstatus.maintenance.v1.MaintenanceService/createMaintenance": {
    event: Events.CreateMaintenance,
  },
  "openstatus.maintenance.v1.MaintenanceService/updateMaintenance": {
    event: Events.UpdateMaintenance,
  },
  "openstatus.maintenance.v1.MaintenanceService/deleteMaintenance": {
    event: Events.DeleteMaintenance,
  },

  // NotificationService
  "openstatus.notification.v1.NotificationService/createNotification": {
    event: Events.CreateNotification,
    eventProps: ["provider"],
  },
  "openstatus.notification.v1.NotificationService/updateNotification": {
    event: Events.UpdateNotification,
  },
  "openstatus.notification.v1.NotificationService/deleteNotification": {
    event: Events.DeleteNotification,
  },
};

/**
 * Tracking interceptor for ConnectRPC.
 * Fires OpenPanel analytics events on successful RPC calls.
 * Must be placed after authInterceptor (needs workspace context)
 * and validationInterceptor (only track valid requests).
 */
export function trackingInterceptor(): Interceptor {
  return (next) => async (req) => {
    const response = await next(req);

    const key = `${req.service.typeName}/${req.method.name}`;
    const mapping = RPC_EVENT_MAP[key];

    if (!mapping) {
      return response;
    }

    const rpcCtx = req.contextValues.get(RPC_CONTEXT_KEY);

    if (!rpcCtx) {
      return response;
    }

    const additionalProps = parseInputToProps(req.message, mapping.eventProps);

    setupAnalytics({
      userId: `api_${rpcCtx.workspace.id}`,
      workspaceId: `${rpcCtx.workspace.id}`,
      plan: rpcCtx.workspace.plan,
      location: req.header.get("x-forwarded-for") ?? undefined,
      userAgent: req.header.get("user-agent") ?? undefined,
    })
      .then((analytics) =>
        analytics.track({ ...mapping.event, additionalProps }),
      )
      .catch(() => {
        logger.warn(
          "Failed to send analytics event {event} for workspace {workspaceId}",
          {
            event: mapping.event.name,
            workspaceId: rpcCtx.workspace.id,
          },
        );
      });

    return response;
  };
}
