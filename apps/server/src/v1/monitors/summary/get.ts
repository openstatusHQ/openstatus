import { createRoute, z } from "@hono/zod-openapi";

import { db, eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import { OSTinybird } from "@openstatus/tinybird";
import { Redis } from "@openstatus/upstash";

import { isoDate } from "../../utils";
import { env } from "../../../env";
import { ParamsSchema } from "../schema";
import { openApiErrorResponses } from "../../../libs/errors/openapi-error-responses";
import type { monitorsApi } from "../index";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });
const redis = Redis.fromEnv();

const dailyStatsSchema = z.object({
  ok: z.number().int().openapi({
    description: "The number of ok responses",
  }),
  count: z
    .number()
    .int()
    .openapi({ description: "The total number of request" }),
  day: isoDate,
});

const dailyStatsSchemaArray = z
  .array(dailyStatsSchema)
  .openapi({ description: "The daily stats" });

const getMonitorStats = createRoute({
  method: "get",
  tags: ["monitor"],
  description: "Get monitor daily summary",
  path: "/:id/summary",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: dailyStatsSchemaArray,
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
    const workspaceId = Number(c.get("workspaceId"));
    const { id } = c.req.valid("param");

    const monitorId = Number(id);
    const _monitor = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, monitorId))
      .get();

    if (!_monitor) return c.json({ code: 404, message: "Not Found" }, 404);

    if (workspaceId !== _monitor.workspaceId)
      return c.json({ code: 401, message: "Unauthorized" }, 401);

    const cache = await redis.get<z.infer<typeof dailyStatsSchemaArray>>(
      `${monitorId}-daily-stats`,
    );
    if (cache) {
      console.log("fetching from cache");
      return c.json({
        data: cache,
      });
    }

    // FIXME: we should use the OSTinybird client
    console.log("fetching from tinybird");
    const res = await tb.endpointStatusPeriod("45d")({
      monitorId: String(monitorId),
    });

    await redis.set(`${monitorId}-daily-stats`, res, { ex: 600 });

    return c.json({ data: res });
  });
}
