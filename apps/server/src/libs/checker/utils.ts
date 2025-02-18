import { OpenStatusApiError } from "@/libs/errors";
import type { z } from "@hono/zod-openapi";
import type { selectMonitorSchema } from "@openstatus/db/src/schema";
import {
  type httpPayloadSchema,
  type tpcPayloadSchema,
  transformHeaders,
} from "@openstatus/utils";

export function getCheckerPayload(
  monitor: z.infer<typeof selectMonitorSchema>,
  status: z.infer<typeof selectMonitorSchema>["status"],
): z.infer<typeof httpPayloadSchema> | z.infer<typeof tpcPayloadSchema> {
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
      };
    default:
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message:
          "Invalid jobType, currently only 'http' and 'tcp' are supported",
      });
  }
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
      return `https://openstatus-checker.fly.dev/checker/http?monitor_id=${monitor.id}&trigger=${opts.trigger}&data=${opts.data}`;
    case "tcp":
      return `https://openstatus-checker.fly.dev/checker/tcp?monitor_id=${monitor.id}&trigger=${opts.trigger}&data=${opts.data}`;
    default:
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message:
          "Invalid jobType, currently only 'http' and 'tcp' are supported",
      });
  }
}
