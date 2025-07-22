import { createRoute } from "@hono/zod-openapi";

import { Events } from "@openstatus/analytics";
import { and, db, eq, isNull, sql } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import type { monitorsApi } from "./index";
import { MonitorSchema, TCPMonitorSchema } from "./schema";

const postRoute = createRoute({
  method: "post",
  tags: ["monitor"],
  summary: "Create a  tcp monitor",
  path: "/tcp",
  middleware: [trackMiddleware(Events.CreateMonitor, ["url", "jobType"])],
  request: {
    body: {
      description: "The monitor to create",
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
      description: "Create a monitor",
    },
    ...openApiErrorResponses,
  },
});

export function registerPostMonitorTCP(api: typeof monitorsApi) {
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

    if (count >= limits.monitors) {
      throw new OpenStatusApiError({
        code: "PAYMENT_REQUIRED",
        message: "Upgrade for more monitors",
      });
    }

    if (!limits.periodicity.includes(input.frequency)) {
      throw new OpenStatusApiError({
        code: "PAYMENT_REQUIRED",
        message: "Upgrade for more periodicity",
      });
    }

    for (const region of input.regions) {
      if (!limits.regions.includes(region)) {
        throw new OpenStatusApiError({
          code: "PAYMENT_REQUIRED",
          message: "Upgrade for more regions",
        });
      }
    }

    const { request, regions, openTelemetry, ...rest } = input;
    const otelHeadersEntries = openTelemetry?.headers
      ? Object.entries(openTelemetry.headers).map(([key, value]) => ({
          key: key,
          value: value,
        }))
      : undefined;

    const _newMonitor = await db
      .insert(monitor)
      .values({
        ...rest,
        jobType: "tcp",
        periodicity: input.frequency,
        url: `${request.host}:${request.port}`,
        workspaceId: workspaceId,
        regions: regions ? regions.join(",") : undefined,
        headers: undefined,
        assertions: undefined,
        timeout: input.timeout || 45000,
        otelHeaders: otelHeadersEntries
          ? JSON.stringify(otelHeadersEntries)
          : undefined,
        otelEndpoint: openTelemetry?.endpoint,
      })
      .returning()
      .get();

    const data = MonitorSchema.parse({ ..._newMonitor, openTelemetry: _newMonitor.otelEndpoint ? {headers: _newMonitor.otelHeaders ?? undefined, endpoint: _newMonitor.otelEndpoint ?? undefined} : undefined });

    return c.json(data, 200);
  });
}
