import { createRoute, z } from "@hono/zod-openapi";

import { Events } from "@openstatus/analytics";
import { and, db, eq, isNull, sql } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { HTTPException } from "hono/http-exception";
import { serialize } from "../../../../../packages/assertions/src";

import { getLimit } from "@openstatus/db/src/schema/plan/utils";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { trackMiddleware } from "../middleware";
import type { monitorsApi } from "./index";
import { MonitorSchema } from "./schema";
import { getAssertions } from "./utils";

const postRoute = createRoute({
  method: "post",
  tags: ["monitor"],
  description: "Create a monitor",
  path: "/",
  middleware: [trackMiddleware(Events.CreateMonitor, ["url", "jobType"])],
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
    const workspaceId = c.get("workspace").id;
    const limits = c.get("workspace").limits;
    const input = c.req.valid("json");
    const count = (
      await db
        .select({ count: sql<number>`count(*)` })
        .from(monitor)
        .where(
          and(eq(monitor.workspaceId, workspaceId), isNull(monitor.deletedAt)),
        )
        .all()
    )[0].count;

    if (count >= getLimit(limits, "monitors")) {
      throw new HTTPException(403, {
        message: "Upgrade for more monitors",
      });
    }

    if (!getLimit(limits, "periodicity").includes(input.periodicity)) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    for (const region of input.regions) {
      if (!getLimit(limits, "regions").includes(region)) {
        throw new HTTPException(403, { message: "Upgrade for more region" });
      }
    }

    if (input.jobType && !["http", "tcp"].includes(input.jobType)) {
      throw new HTTPException(400, {
        message:
          "Invalid jobType, currently only 'http' and 'tcp' are supported",
      });
    }

    const { headers, regions, assertions, ...rest } = input;

    const assert = assertions ? getAssertions(assertions) : [];

    const _newMonitor = await db
      .insert(monitor)
      .values({
        ...rest,
        workspaceId: workspaceId,
        regions: regions ? regions.join(",") : undefined,
        headers: input.headers ? JSON.stringify(input.headers) : undefined,
        assertions: assert.length > 0 ? serialize(assert) : undefined,
        timeout: input.timeout || 45000,
      })
      .returning()
      .get();

    const data = MonitorSchema.parse(_newMonitor);

    return c.json(data, 200);
  });
}
