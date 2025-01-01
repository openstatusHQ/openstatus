import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import { Events } from "@openstatus/analytics";
import { serialize } from "@openstatus/assertions";
import type { monitorsApi } from "./index";
import { MonitorSchema, ParamsSchema } from "./schema";
import { getAssertions } from "./utils";

const putRoute = createRoute({
  method: "put",
  tags: ["monitor"],
  summary: "Update a monitor",
  path: "/:id",
  middleware: [trackMiddleware(Events.UpdateMonitor)],
  request: {
    params: ParamsSchema,
    body: {
      description: "The monitor to update",
      content: {
        "application/json": {
          schema: MonitorSchema.omit({ id: true }).partial(),
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
      description: "Update a monitor",
    },
    ...openApiErrorResponses,
  },
});

export function registerPutMonitor(api: typeof monitorsApi) {
  return api.openapi(putRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const limits = c.get("workspace").limits;
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    if (input.periodicity && !limits.periodicity.includes(input.periodicity)) {
      throw new OpenStatusApiError({
        code: "PAYMENT_REQUIRED",
        message: "Upgrade for more periodicity",
      });
    }

    if (input.regions) {
      for (const region of input.regions) {
        if (!limits.regions.includes(region)) {
          throw new OpenStatusApiError({
            code: "PAYMENT_REQUIRED",
            message: "Upgrade for more regions",
          });
        }
      }
    }

    const _monitor = await db
      .select()
      .from(monitor)
      .where(
        and(
          eq(monitor.id, Number(id)),
          isNull(monitor.deletedAt),
          eq(monitor.workspaceId, workspaceId),
        ),
      )
      .get();

    if (!_monitor) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Monitor ${id} not found`,
      });
    }

    if (input.jobType && input.jobType !== _monitor.jobType) {
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message:
          "Cannot change jobType. Please delete and create a new monitor instead.",
      });
    }

    const { headers, regions, assertions, ...rest } = input;

    const assert = assertions ? getAssertions(assertions) : [];

    const _newMonitor = await db
      .update(monitor)
      .set({
        ...rest,
        regions: regions ? regions.join(",") : undefined,
        headers: input.headers ? JSON.stringify(input.headers) : undefined,
        assertions: assert.length > 0 ? serialize(assert) : undefined,
        timeout: input.timeout || 45000,
        updatedAt: new Date(),
      })
      .where(eq(monitor.id, Number(_monitor.id)))
      .returning()
      .get();

    const data = MonitorSchema.parse(_newMonitor);
    return c.json(data, 200);
  });
}
