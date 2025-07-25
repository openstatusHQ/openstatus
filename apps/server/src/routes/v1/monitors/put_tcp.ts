import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import { Events } from "@openstatus/analytics";
import type { monitorsApi } from "./index";
import { MonitorSchema, ParamsSchema, TCPMonitorSchema } from "./schema";

const putRoute = createRoute({
  method: "put",
  tags: ["monitor"],
  summary: "Update an TCP monitor",
  path: "/tcp/{id}",
  middleware: [trackMiddleware(Events.UpdateMonitor)],
  request: {
    params: ParamsSchema,
    body: {
      description: "The monitor to update",
      content: {
        "application/json": {
          schema: TCPMonitorSchema,
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

export function registerPutTCPMonitor(api: typeof monitorsApi) {
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

    if (_monitor.jobType !== "tcp") {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Monitor ${id} not found`,
      });
    }

    const { request, regions, openTelemetry, ...rest } = input;

    const otelHeadersEntries = openTelemetry?.headers
      ? Object.entries(openTelemetry.headers).map(([key, value]) => ({
          key: key,
          value: value,
        }))
      : undefined;

    const _newMonitor = await db
      .update(monitor)
      .set({
        ...rest,
        periodicity: input.frequency,
        url: `${request.host}:${request.port}`,
        regions: regions ? regions.join(",") : undefined,
        otelHeaders: otelHeadersEntries
          ? JSON.stringify(otelHeadersEntries)
          : undefined,
        otelEndpoint: openTelemetry?.endpoint,
        timeout: input.timeout || 45000,
        updatedAt: new Date(),
      })
      .where(eq(monitor.id, Number(_monitor.id)))
      .returning()
      .get();
    const otelHeader = _newMonitor.otelHeaders
      ? z
          .array(
            z.object({
              key: z.string(),
              value: z.string(),
            }),
          )
          .parse(JSON.parse(_newMonitor.otelHeaders))
          // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
          .reduce((a, v) => ({ ...a, [v.key]: v.value }), {})
      : undefined;

    const data = MonitorSchema.parse({
      ..._newMonitor,
      openTelemetry: _newMonitor.otelEndpoint
        ? {
            headers: otelHeader,
            endpoint: _newMonitor.otelEndpoint ?? undefined,
          }
        : undefined,
    });
    return c.json(data, 200);
  });
}
