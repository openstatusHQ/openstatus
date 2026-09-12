import { db } from "@openstatus/db";
import { flyServer } from "@openstatus/health-fly";
import { healthRoute } from "@openstatus/health-hono";
import { tinybirdProbe } from "@openstatus/health-tinybird";
import { tursoProbe } from "@openstatus/health-turso";
import { TINYBIRD_DEFAULT_URL, isTinybirdNoop } from "@openstatus/tinybird";
import type { RequestIdVariables } from "hono/request-id";

import { env } from "./env";

const { TINYBIRD_URL, TINYBIRD_NOOP } = env();

// Kept at `/ping`: Fly's http check and the Dockerfile healthcheck poll it.
// `deadlineMs` stays under Fly's 10s timeout.
export const pingRoute = healthRoute<{ Variables: RequestIdVariables }>({
  path: "/ping",
  deadlineMs: 8_000,
  probes: [
    tursoProbe({ client: db.$client }),
    tinybirdProbe({
      baseUrl: TINYBIRD_URL || TINYBIRD_DEFAULT_URL,
      skip: () => isTinybirdNoop(TINYBIRD_NOOP),
    }),
  ],
  extend: (_report, c) => ({
    server: flyServer(),
    requestId: c.get("requestId"),
  }),
});
