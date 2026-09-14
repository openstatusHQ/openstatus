import { db } from "@openstatus/db";
import { createHealthHandler } from "@openstatus/health";
import { tinybirdProbe } from "@openstatus/health-tinybird";
import { tursoProbe } from "@openstatus/health-turso";
import { upstashProbe } from "@openstatus/health-upstash";
import { TINYBIRD_DEFAULT_URL, isTinybirdNoop } from "@openstatus/tinybird";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createHealthHandler({
  deadlineMs: 4_000,
  probes: [
    tursoProbe({ client: db.$client }),
    tinybirdProbe({
      baseUrl: process.env.TINYBIRD_URL || TINYBIRD_DEFAULT_URL,
      skip: () =>
        !process.env.TINY_BIRD_API_KEY ||
        isTinybirdNoop(process.env.TINYBIRD_NOOP),
    }),
    // Probe factories reject an empty url at construction; a local `.env`
    // leaves Upstash blank.
    ...(process.env.UPSTASH_REDIS_REST_URL
      ? [
          upstashProbe({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
          }),
        ]
      : []),
  ],
});

export const GET = handler;
export const HEAD = handler;
