import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, isNull } from "@openstatus/db";
import { monitor, monitorRun } from "@openstatus/db/src/schema";
import { OSTinybird } from "@openstatus/tinybird";

import { flyRegions } from "@openstatus/db/src/schema/constants";
import { HTTPException } from "hono/http-exception";
import { env } from "../../../env";
import { openApiErrorResponses } from "../../../libs/errors/openapi-error-responses";
import type { monitorsApi } from "../index";
import { ParamsSchema } from "../schema";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

const timingSchema = z.object({
  dnsStart: z.number(),
  dnsDone: z.number(),
  connectStart: z.number(),
  connectDone: z.number(),
  tlsHandshakeStart: z.number(),
  tlsHandshakeDone: z.number(),
  firstByteStart: z.number(),
  firstByteDone: z.number(),
  transferStart: z.number(),
  transferDone: z.number(),
});

const getMonitorStats = createRoute({
  method: "get",
  tags: ["monitor"],
  description: "Get a monitor result",
  path: "/:id/result/:resultId",
  request: {
    params: ParamsSchema.extend({
      resultId: z.number().int().openapi({
        description: "The id of the result",
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              latency: z.number().int(), // in ms
              statusCode: z.number().int().nullable().default(null),
              monitorId: z.string().default(""),
              url: z.string().url().optional(),
              error: z
                .number()
                .default(0)
                .transform((val) => val !== 0),
              region: z.enum(flyRegions),
              timestamp: z.number().int().optional(),
              message: z.string().nullable().optional(),
              timing: z
                .string()
                .nullable()
                .optional()
                .transform((val) => {
                  if (!val) return null;
                  const value = timingSchema.safeParse(JSON.parse(val));
                  if (value.success) return value.data;
                  return null;
                }),
            }),
          }),
        },
      },
      description: "All the metrics for the monitor",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetMonitorResult(api: typeof monitorsApi) {
  return api.openapi(getMonitorStats, async (c) => {
    const workspaceId = c.get("workspaceId");
    const { id, resultId } = c.req.valid("param");

    const _monitorRun = await db
      .select()
      .from(monitorRun)
      .where(
        and(
          eq(monitorRun.id, Number(resultId)),
          eq(monitorRun.monitorId, Number(id)),
          eq(monitorRun.workspaceId, Number(workspaceId))
        )
      )
      .get();

    if (!_monitorRun || !_monitorRun?.runnedAt) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    const _monitor = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, Number(id)))
      .get();

    if (!_monitor) {
      throw new HTTPException(404, { message: "Not Found" });
    }
    // Fetch result from tb pipe
    const data = await tb.getResultForOnDemandCheckHttp()({
      monitorId: _monitor.id,
      timestamp: _monitorRun.runnedAt?.getTime(),
      url: _monitor.url,
    });
    // return array of results
    if (!data) {
      throw new HTTPException(404, { message: "Not Found" });
    }
    return c.json({ data }, 200);
  });
}
