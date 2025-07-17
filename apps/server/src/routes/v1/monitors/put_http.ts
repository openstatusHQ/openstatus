import { createRoute } from "@hono/zod-openapi";

import { and, db, eq, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import { Events } from "@openstatus/analytics";
import { serialize } from "@openstatus/assertions";
import type { monitorsApi } from "./index";
import { HTTPMonitorSchema, MonitorSchema, ParamsSchema } from "./schema";
import { getAssertionNew } from "./utils";

const putRoute = createRoute({
  method: "put",
  tags: ["monitor"],
  summary: "Update an HTTP monitor",
  path: "/http/{id}",
  middleware: [trackMiddleware(Events.UpdateMonitor)],
  request: {
    params: ParamsSchema,
    body: {
      description: "The monitor to update",
      content: {
        "application/json": {
          schema: HTTPMonitorSchema,
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

export function registerPutHTTPMonitor(api: typeof monitorsApi) {
  return api.openapi(putRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const limits = c.get("workspace").limits;
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    if (input.frequency && !limits.periodicity.includes(input.frequency)) {
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

    if (_monitor.jobType !== "http") {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Monitor ${id} not found`,
      });
    }

    const { request, regions, assertions, otelHeaders, ...rest } = input;

    const headers = input.request.headers
      ? Object.entries(input.request.headers)
      : undefined;

    const otelHeadersEntries = otelHeaders
      ? Object.entries(otelHeaders).map(([key, value]) => ({
          key: key,
          value: value,
        }))
      : undefined;
    const headersEntries = headers
      ? headers.map(([key, value]) => ({ key: key, value: value }))
      : undefined;
    const assert = assertions ? getAssertionNew(assertions) : [];

    const _newMonitor = await db
      .update(monitor)
      .set({
        ...rest,
        periodicity: input.frequency,
        url: input.request.url,
        method: input.request.method,
        body: input.request.body,
        regions: regions ? regions.join(",") : undefined,
        headers: headersEntries ? JSON.stringify(headersEntries) : undefined,
        otelHeaders: otelHeadersEntries
          ? JSON.stringify(otelHeadersEntries)
          : undefined,
        assertions: assert ? serialize(assert) : "",
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
