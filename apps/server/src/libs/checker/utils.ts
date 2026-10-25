import type { z } from "@hono/zod-openapi";
import type { selectMonitorSchema } from "@openstatus/db/src/schema";
import {
  type CheckerPayload,
  buildCheckerPayload,
  isCheckerJobType,
} from "@openstatus/utils";

import { OpenStatusApiError } from "@/libs/errors";

export function getCheckerPayload(
  monitor: z.infer<typeof selectMonitorSchema>,
  status: z.infer<typeof selectMonitorSchema>["status"],
): CheckerPayload {
  // The v1 routes build the payload before the URL, so reject here to keep a 400.
  if (!isCheckerJobType(monitor.jobType)) {
    throw new OpenStatusApiError({
      code: "BAD_REQUEST",
      message: `Invalid jobType '${monitor.jobType}'`,
    });
  }
  return buildCheckerPayload({
    monitor,
    status,
    trigger: "api",
    timestamp: Date.now(),
  });
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
