import type { z } from "@hono/zod-openapi";
import type { selectMonitorSchema } from "@openstatus/db/src/schema";
import {
  type DNSPayloadSchema,
  type httpPayloadSchema,
  type grpcPayloadSchema,
  type icmpPayloadSchema,
  type tpcPayloadSchema,
  transformHeaders,
} from "@openstatus/utils";

import { OpenStatusApiError } from "@/libs/errors";

export function getCheckerPayload(
  monitor: z.infer<typeof selectMonitorSchema>,
  status: z.infer<typeof selectMonitorSchema>["status"],
):
  | z.infer<typeof httpPayloadSchema>
  | z.infer<typeof tpcPayloadSchema>
  | z.infer<typeof DNSPayloadSchema>
  | z.infer<typeof icmpPayloadSchema>
  | z.infer<typeof grpcPayloadSchema> {
  const timestamp = new Date().getTime();
  switch (monitor.jobType) {
    case "http":
      return {
        workspaceId: String(monitor.workspaceId),
        monitorId: String(monitor.id),
        url: monitor.url,
        method: monitor.method || "GET",
        cronTimestamp: timestamp,
        body: monitor.body,
        headers: monitor.headers,
        status: status,
        assertions: monitor.assertions ? JSON.parse(monitor.assertions) : null,
        degradedAfter: monitor.degradedAfter,
        timeout: monitor.timeout,
        trigger: "api",
        otelConfig: monitor.otelEndpoint
          ? {
              endpoint: monitor.otelEndpoint,
              headers: transformHeaders(monitor.otelHeaders),
            }
          : undefined,
        retry: monitor.retry ?? 0,
        followRedirects: monitor.followRedirects ?? false,
      };
    case "tcp":
      return {
        workspaceId: String(monitor.workspaceId),
        monitorId: String(monitor.id),
        uri: monitor.url,
        status: status,
        assertions: monitor.assertions ? JSON.parse(monitor.assertions) : null,
        cronTimestamp: timestamp,
        degradedAfter: monitor.degradedAfter,
        timeout: monitor.timeout,
        trigger: "api",
        otelConfig: monitor.otelEndpoint
          ? {
              endpoint: monitor.otelEndpoint,
              headers: transformHeaders(monitor.otelHeaders),
            }
          : undefined,
        retry: monitor.retry ?? 0,
        followRedirects: monitor.followRedirects ?? false,
      };
    case "dns":
      return {
        workspaceId: String(monitor.workspaceId),
        monitorId: String(monitor.id),
        uri: monitor.url,
        status: status,
        assertions: monitor.assertions ? JSON.parse(monitor.assertions) : null,
        cronTimestamp: timestamp,
        degradedAfter: monitor.degradedAfter,
        timeout: monitor.timeout,
        trigger: "api",
        otelConfig: monitor.otelEndpoint
          ? {
              endpoint: monitor.otelEndpoint,
              headers: transformHeaders(monitor.otelHeaders),
            }
          : undefined,
        retry: monitor.retry ?? 0,
      };
    case "icmp":
      // No assertions: an ICMP check only reports reachability and latency.
      return {
        workspaceId: String(monitor.workspaceId),
        monitorId: String(monitor.id),
        uri: monitor.url,
        status: status,
        cronTimestamp: timestamp,
        degradedAfter: monitor.degradedAfter,
        timeout: monitor.timeout,
        trigger: "api",
        otelConfig: monitor.otelEndpoint
          ? {
              endpoint: monitor.otelEndpoint,
              headers: transformHeaders(monitor.otelHeaders),
            }
          : undefined,
        retry: monitor.retry ?? 0,
      };
    case "grpc":
      // No assertions: a gRPC health check only reports the serving status.
      return {
        workspaceId: String(monitor.workspaceId),
        monitorId: String(monitor.id),
        uri: monitor.url,
        service: monitor.grpcService ?? undefined,
        tls: monitor.grpcTls ?? "tls",
        headers: transformHeaders(monitor.headers),
        status: status,
        cronTimestamp: timestamp,
        degradedAfter: monitor.degradedAfter,
        timeout: monitor.timeout,
        trigger: "api",
        otelConfig: monitor.otelEndpoint
          ? {
              endpoint: monitor.otelEndpoint,
              headers: transformHeaders(monitor.otelHeaders),
            }
          : undefined,
        retry: monitor.retry ?? 0,
      };
    default:
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message: `Invalid jobType '${monitor.jobType}'`,
      });
  }
}

// Bounds outbound checker fetches so a slow check can't pin API requests open
// indefinitely: the monitor's own timeout plus a buffer for checker overhead.
export function getCheckerTimeout(
  monitor: z.infer<typeof selectMonitorSchema>,
): number {
  return (monitor.timeout ?? 45_000) + 15_000;
}

export function getCheckerUrl(
  monitor: z.infer<typeof selectMonitorSchema>,
  opts: { trigger?: "api" | "cron"; data?: boolean } = {
    trigger: "api",
    data: false,
  },
): string {
  switch (monitor.jobType) {
    case "http":
    case "tcp":
    case "dns":
    case "icmp":
    case "grpc":
      return `https://openstatus-checker.fly.dev/checker/${monitor.jobType}?monitor_id=${monitor.id}&trigger=${opts.trigger}&data=${opts.data}`;
    default:
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message: `Invalid jobType '${monitor.jobType}'`,
      });
  }
}
