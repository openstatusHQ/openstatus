import { createRoute, z } from "@hono/zod-openapi";

import { trackAnalytics } from "@openstatus/analytics";
import { and, db, eq, isNull, sql } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import type { monitorsApi } from "./index";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { MonitorSchema } from "./schema";
import { env } from "../../env";
import { HTTPException } from "hono/http-exception";

const postRoute = createRoute({
  method: "post",
  tags: ["monitor"],
  description: "Create a monitor",
  path: "/",
  request: {
    body: {
      description: "The monitor to create",
      content: {
        "application/json": {
          schema: MonitorSchema.omit({ id: true }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MonitorSchema,
        },
      },
      description: "Create a monitor",
    },
    ...openApiErrorResponses,
  },
});

export function registerPostMonitor(api: typeof monitorsApi) {
  return api.openapi(postRoute, async (c) => {
    const workspaceId = c.get("workspaceId");
    const workspacePlan = c.get("workspacePlan");
    const input = c.req.valid("json");

    const count = (
      await db
        .select({ count: sql<number>`count(*)` })
        .from(monitor)
        .where(
          and(
            eq(monitor.workspaceId, Number(workspaceId)),
            isNull(monitor.deletedAt)
          )
        )
        .all()
    )[0].count;

    if (count >= workspacePlan.limits.monitors) {
      throw new HTTPException(403, {
        message: "Upgrade for more monitors",
      });
    }

    if (!workspacePlan.limits.periodicity.includes(input.periodicity)) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    const { headers, regions, ...rest } = input;
    const _newMonitor = await db
      .insert(monitor)
      .values({
        ...rest,
        workspaceId: Number(workspaceId),
        regions: regions ? regions.join(",") : undefined,
        headers: input.headers ? JSON.stringify(input.headers) : undefined,
      })
      .returning()
      .get();

    if (env.JITSU_WRITE_KEY) {
      trackAnalytics({
        event: "Monitor Created",
        url: input.url,
        periodicity: input.periodicity,
        api: true,
        workspaceId: String(workspaceId),
      });
    }

    const data = MonitorSchema.parse(_newMonitor);

    return c.json(data);
  });
}
