import { createRoute } from "@hono/zod-openapi";

import { and, db, eq, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import { Events } from "@openstatus/analytics";
import { serialize } from "@openstatus/assertions";
import type { monitorsApi } from "./index";
import { HTTPMonitorSchema, MonitorSchema, ParamsSchema, TCPMonitorSchema } from "./schema";
import { getAssertionNew } from "./utils";

const putRoute = createRoute({
  method: "put",
  tags: ["monitor"],
  summary: "Update a monitor",
  path: "/{id}",
  middleware: [trackMiddleware(Events.UpdateMonitor)],
  request: {
    params: ParamsSchema,
    body: {
      description: "The monitor to update",
      content: {
        "application/json": {
          schema: HTTPMonitorSchema.partial().or(TCPMonitorSchema.partial()),
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


    if (_monitor.jobType === "http" ) {
      const data = HTTPMonitorSchema.partial().parse(input)
      const { request, regions, assertions, otelHeaders, ...rest } = data;

      const headers = data?.request?.headers
        ? Object.entries(data?.request.headers)
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
          regions: regions ? regions.join(",") : _monitor.regions,
          headers: headersEntries ? JSON.stringify(headersEntries) : _monitor.headers,
          otelHeaders: otelHeadersEntries ? JSON.stringify(otelHeadersEntries) : _monitor.otelHeaders,
          assertions: assert.length > 0 ? serialize(assert) : _monitor.assertions,
          timeout: input.timeout || 45000,
          updatedAt: new Date(),
        })
        .where(eq(monitor.id, Number(_monitor.id)))
        .returning()
        .get();
      const r = MonitorSchema.parse(_newMonitor);
      return c.json(r, 200);
    }
    if(_monitor.jobType === "tcp") {
      const data = TCPMonitorSchema.partial().parse(input)
      const { request, regions,  otelHeaders, ...rest } = data;


      const otelHeadersEntries = otelHeaders
        ? Object.entries(otelHeaders).map(([key, value]) => ({
            key: key,
            value: value,
          }))
        : undefined;



      const _newMonitor = await db
        .update(monitor)
        .set({
          ...rest,
          regions: regions ? regions.join(",") : _monitor.regions,
          otelHeaders: otelHeadersEntries ? JSON.stringify(otelHeadersEntries) : _monitor.otelHeaders,
          timeout: input.timeout || 45000,
          updatedAt: new Date(),
        })
        .where(eq(monitor.id, Number(_monitor.id)))
        .returning()
        .get();
      const r = MonitorSchema.parse(_newMonitor);
      return c.json(r, 200);
    }


    throw new OpenStatusApiError({
      code: "NOT_FOUND",
      message: 'Something went wrong',
    });

  });
}
