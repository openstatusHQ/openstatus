import { db } from "@openstatus/db";
import { flyServer } from "@openstatus/health-fly";
import { healthRoute } from "@openstatus/health-hono";
import { tinybirdProbe } from "@openstatus/health-tinybird";
import { tursoProbe } from "@openstatus/health-turso";
import { unkeyProbe } from "@openstatus/health-unkey";
import { upstashProbe } from "@openstatus/health-upstash";
import { TINYBIRD_DEFAULT_URL, isTinybirdNoop } from "@openstatus/tinybird";
import type { RequestIdVariables } from "hono/request-id";

import { env } from "@/env";

// Kept at `/ping`: Fly's http check, the Dockerfile healthcheck and the public
// openstatus monitor all poll it. `deadlineMs` stays under Fly's 5s timeout.
export const pingRoute = healthRoute<{ Variables: RequestIdVariables }>({
  path: "/ping",
  deadlineMs: 4_000,
  probes: [
    tursoProbe({ client: db.$client }),
    tinybirdProbe({
      baseUrl: env.TINYBIRD_URL || TINYBIRD_DEFAULT_URL,
      skip: () => isTinybirdNoop(env.TINYBIRD_NOOP),
    }),
    unkeyProbe(),
    // Probe factories reject an empty url at construction; a local `.env`
    // leaves Upstash blank.
    ...(env.UPSTASH_REDIS_REST_URL
      ? [
          upstashProbe({
            url: env.UPSTASH_REDIS_REST_URL,
            token: env.UPSTASH_REDIS_REST_TOKEN,
          }),
        ]
      : []),
  ],
  extend: (_report, c) => ({
    server: flyServer(),
    requestId: c.get("requestId"),
  }),
});
