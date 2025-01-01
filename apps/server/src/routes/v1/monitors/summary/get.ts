import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import { OSTinybird } from "@openstatus/tinybird";
import { Redis } from "@openstatus/upstash";

import { env } from "@/env";
import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import type { monitorsApi } from "../index";
import { ParamsSchema, SummarySchema } from "./schema";

// TODO: is there another better way to mock Redis/Tinybird?
if (process.env.NODE_ENV === "test") {
  require("@/libs/test/preload");
}

const tb = new OSTinybird(env.TINY_BIRD_API_KEY);
const redis = Redis.fromEnv();

const getMonitorStats = createRoute({
  method: "get",
  tags: ["monitor"],
  summary: "Get a monitor summary",
  description:
    "Get a monitor summary of the last 45 days of data to be used within a status page",
  path: "/:id/summary",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: SummarySchema.array(),
          }),
        },
      },
      description: "All the historical metrics",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetMonitorSummary(api: typeof monitorsApi) {
  return api.openapi(getMonitorStats, async (c) => {
    const workspaceId = c.get("workspace").id;
    const { id } = c.req.valid("param");

    const _monitor = await db
      .select()
      .from(monitor)
      .where(
        and(
          eq(monitor.id, Number(id)),
          eq(monitor.workspaceId, workspaceId),
          isNull(monitor.deletedAt),
        ),
      )
      .get();

    if (!_monitor) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Monitor ${id} not found`,
      });
    }

    const cache = await redis.get<SummarySchema[]>(`${id}-daily-stats`);

    if (cache) {
      console.log("fetching from cache");
      return c.json({ data: cache }, 200);
    }

    console.log("fetching from tinybird");
    const res =
      _monitor.jobType === "http"
        ? await tb.httpStatus45d({ monitorId: id })
        : await tb.tcpStatus45d({ monitorId: id });

    await redis.set(`${id}-daily-stats`, res.data, { ex: 600 });

    return c.json({ data: res.data }, 200);
  });
}
