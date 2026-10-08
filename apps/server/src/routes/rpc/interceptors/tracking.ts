import type { Interceptor } from "@connectrpc/connect";
import { getLogger } from "@logtape/logtape";
import {
  type EventProps,
  Events,
  parseInputToProps,
  setupAnalytics,
} from "@openstatus/analytics";

import { apiAnalyticsIdentity } from "../../../libs/analytics-identity";
import { parseCliHeaders, trackCliCommand } from "../../../libs/cli-telemetry";
import { RPC_CONTEXT_KEY } from "./auth";

const logger = getLogger("api-server");

type RpcEventMapping = {
  event: EventProps;
  eventProps?: string[];
  normalizeInput?: (message: unknown) => Record<string, unknown>;
};

// Create*Monitor requests nest the config under `monitor`, so top-level
// extraction yields nothing; ICMP and gRPC name their target `uri` and none of
// them carries jobType on the wire.
function monitorCreateInput(jobType: string) {
  return (message: unknown): Record<string, unknown> => {
    if (typeof message !== "object" || message === null) return {};
    const { monitor } = message as {
      monitor?: Record<string, unknown> | undefined;
    };
    if (!monitor) return {};
    return { ...monitor, url: monitor.uri ?? monitor.url, jobType };
  };
}

/**
 * Mapping from "ServiceTypeName/MethodName" to OpenPanel event + optional props.
 * Keys use PascalCase method names matching DescMethod.name (the proto source name).
 * Matches the same Events used by v1 REST trackMiddleware for parity.
 */
export const RPC_EVENT_MAP: Record<string, RpcEventMapping> = {
  // MonitorService
  "openstatus.monitor.v1.MonitorService/CreateHTTPMonitor": {
    event: Events.CreateMonitor,
    eventProps: ["url", "jobType"],
    normalizeInput: monitorCreateInput("http"),
  },
  "openstatus.monitor.v1.MonitorService/CreateTCPMonitor": {
    event: Events.CreateMonitor,
    eventProps: ["url", "jobType"],
    normalizeInput: monitorCreateInput("tcp"),
  },
  "openstatus.monitor.v1.MonitorService/CreateDNSMonitor": {
    event: Events.CreateMonitor,
    eventProps: ["url", "jobType"],
    normalizeInput: monitorCreateInput("dns"),
  },
  "openstatus.monitor.v1.MonitorService/CreateICMPMonitor": {
    event: Events.CreateMonitor,
    eventProps: ["url", "jobType"],
    normalizeInput: monitorCreateInput("icmp"),
  },
  "openstatus.monitor.v1.MonitorService/CreateGRPCMonitor": {
    event: Events.CreateMonitor,
    eventProps: ["url", "jobType"],
    normalizeInput: monitorCreateInput("grpc"),
  },
  "openstatus.monitor.v1.MonitorService/UpdateHTTPMonitor": {
    event: Events.UpdateMonitor,
  },
  "openstatus.monitor.v1.MonitorService/UpdateTCPMonitor": {
    event: Events.UpdateMonitor,
  },
  "openstatus.monitor.v1.MonitorService/UpdateDNSMonitor": {
    event: Events.UpdateMonitor,
  },
  "openstatus.monitor.v1.MonitorService/UpdateICMPMonitor": {
    event: Events.UpdateMonitor,
  },
  "openstatus.monitor.v1.MonitorService/UpdateGRPCMonitor": {
    event: Events.UpdateMonitor,
  },
  "openstatus.monitor.v1.MonitorService/DeleteMonitor": {
    event: Events.DeleteMonitor,
  },

  // StatusReportService
  "openstatus.status_report.v1.StatusReportService/CreateStatusReport": {
    event: Events.CreateReport,
  },
  "openstatus.status_report.v1.StatusReportService/UpdateStatusReport": {
    event: Events.UpdateReport,
  },
  "openstatus.status_report.v1.StatusReportService/DeleteStatusReport": {
    event: Events.DeleteReport,
  },
  "openstatus.status_report.v1.StatusReportService/AddStatusReportUpdate": {
    event: Events.CreateReportUpdate,
  },

  // StatusPageService
  "openstatus.status_page.v1.StatusPageService/CreateStatusPage": {
    event: Events.CreatePage,
    eventProps: ["slug"],
  },
  "openstatus.status_page.v1.StatusPageService/UpdateStatusPage": {
    event: Events.UpdatePage,
  },
  "openstatus.status_page.v1.StatusPageService/DeleteStatusPage": {
    event: Events.DeletePage,
  },
  "openstatus.status_page.v1.StatusPageService/SubscribeToPage": {
    event: Events.SubscribePage,
  },

  // MaintenanceService
  "openstatus.maintenance.v1.MaintenanceService/CreateMaintenance": {
    event: Events.CreateMaintenance,
  },
  "openstatus.maintenance.v1.MaintenanceService/UpdateMaintenance": {
    event: Events.UpdateMaintenance,
  },
  "openstatus.maintenance.v1.MaintenanceService/DeleteMaintenance": {
    event: Events.DeleteMaintenance,
  },

  // NotificationService
  "openstatus.notification.v1.NotificationService/CreateNotification": {
    event: Events.CreateNotification,
    eventProps: ["provider"],
  },
  "openstatus.notification.v1.NotificationService/UpdateNotification": {
    event: Events.UpdateNotification,
  },
  "openstatus.notification.v1.NotificationService/DeleteNotification": {
    event: Events.DeleteNotification,
  },

  // PrivateLocationService
  "openstatus.private_location.v1.PrivateLocationService/CreatePrivateLocation":
    {
      event: Events.CreatePrivateLocation,
    },
  "openstatus.private_location.v1.PrivateLocationService/UpdatePrivateLocation":
    {
      event: Events.UpdatePrivateLocation,
    },
  "openstatus.private_location.v1.PrivateLocationService/DeletePrivateLocation":
    {
      event: Events.DeletePrivateLocation,
    },
};

/**
 * Tracking interceptor for ConnectRPC.
 *
 * Every authenticated call fires an `api_request` event — reads included, and
 * failures too (`success: false`) — so API volume is countable per workspace
 * the same way `mcp_request` counts MCP traffic. Successful calls listed in
 * `RPC_EVENT_MAP` additionally fire their domain event (e.g. `monitor_created`).
 *
 * Requests from the openstatus CLI also carry `cliCommand`/`cliVersion` on
 * `api_request`, and the first request of each CLI run fires one `cli_command`.
 *
 * Must be placed after authInterceptor (needs workspace context) and
 * validationInterceptor (requests it rejects never reach here, so they are not
 * counted). Unauthenticated calls (HealthService) carry no context and are
 * skipped.
 */
export function trackingInterceptor(): Interceptor {
  return (next) => async (req) => {
    let success = false;
    try {
      const response = await next(req);
      success = true;
      return response;
    } finally {
      // Tracking must never replace the call's own result or error.
      try {
        trackRpcCall(req, success);
      } catch {
        logger.warn("Failed to track RPC call {method}", {
          method: `${req.service.typeName}/${req.method.name}`,
        });
      }
    }
  };
}

type TrackedRequest = Parameters<Parameters<Interceptor>[0]>[0];

function trackRpcCall(req: TrackedRequest, success: boolean) {
  const rpcCtx = req.contextValues.get(RPC_CONTEXT_KEY);

  if (!rpcCtx) {
    return;
  }

  const key = `${req.service.typeName}/${req.method.name}`;
  const mapping = success ? RPC_EVENT_MAP[key] : undefined;
  const cli = parseCliHeaders(req.header);

  const events: (EventProps & Record<string, unknown>)[] = [
    {
      ...Events.ApiRequest,
      service: req.service.typeName,
      method: req.method.name,
      success,
      ...(cli ? { cliCommand: cli.command } : {}),
      ...(cli?.version ? { cliVersion: cli.version } : {}),
    },
  ];

  if (mapping) {
    const input = mapping.normalizeInput?.(req.message) ?? req.message;
    const additionalProps = parseInputToProps(input, mapping.eventProps);
    events.push({ ...additionalProps, ...mapping.event });
  }

  setupAnalytics(apiAnalyticsIdentity(rpcCtx.workspace, req.header))
    .then((analytics) =>
      Promise.all([
        ...events.map((event) => analytics.track(event)),
        ...(cli ? [trackCliCommand(analytics, rpcCtx.workspace.id, cli)] : []),
      ]),
    )
    .catch(() => {
      logger.warn(
        "Failed to send analytics events for {method} in workspace {workspaceId}",
        { method: key, workspaceId: rpcCtx.workspace.id },
      );
    });
}
