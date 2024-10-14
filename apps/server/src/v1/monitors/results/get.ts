import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, isNull } from "@openstatus/db";
import { monitorRun } from "@openstatus/db/src/schema";
import { OSTinybird } from "@openstatus/tinybird";
import { Redis } from "@openstatus/upstash";

import { HTTPException } from "hono/http-exception";
import { env } from "../../../env";
import { openApiErrorResponses } from "../../../libs/errors/openapi-error-responses";
import { isoDate } from "../../utils";
import type { monitorsApi } from "../index";
import { ParamsSchema } from "../schema";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

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
            data: z.string(),
          }),
        },
      },
      description: "All the metrics for the monitor",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetMonitorSummary(api: typeof monitorsApi) {
  return api.openapi(getMonitorStats, async (c) => {
    const workspaceId = c.get("workspaceId");
    const { id, resultId } = c.req.valid("param");

    const _monitor = await db
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

    if (!_monitor) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    // Fetch result from tb pipe

    // return array of results

    return c.json({ data: "undefined" }, 200);
  });
}
