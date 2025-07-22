import { createRoute } from "@hono/zod-openapi";

import { Events } from "@openstatus/analytics";
import { and, db, eq, isNull, sql } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { serialize } from "@openstatus/assertions";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import type { monitorsApi } from "./index";
import { HTTPMonitorSchema, MonitorSchema } from "./schema";
import { getAssertionNew } from "./utils";

const postRoute = createRoute({
  method: "post",
  tags: ["monitor"],
  summary: "Create a  http monitor",
  path: "/http",
  middleware: [trackMiddleware(Events.CreateMonitor, ["url", "jobType"])],
  request: {
    body: {
      description: "The monitor to create",
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
      description: "Create a monitor",
    },
    ...openApiErrorResponses,
  },
});

export function registerPostMonitorHTTP(api: typeof monitorsApi) {
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

    const { request, regions, assertions, openTelemetry, ...rest } = input;

    const headers = input.request.headers
      ? Object.entries(input.request.headers)
      : undefined;

    const otelHeadersEntries = openTelemetry.headers
      ? Object.entries(openTelemetry.headers).map(([key, value]) => ({
          key: key,
          value: value,
        }))
      : undefined;
    const headersEntries = headers
      ? headers.map(([key, value]) => ({ key: key, value: value }))
      : undefined;
    const assert = assertions ? getAssertionNew(assertions) : [];

    const _newMonitor = await db
      .insert(monitor)
      .values({
        ...rest,
        periodicity: input.frequency,
        jobType: "http",
        url: request.url,
        method: request.method,
        body: request.body,
        workspaceId: workspaceId,
        regions: regions ? regions.join(",") : undefined,
        headers: headersEntries ? JSON.stringify(headersEntries) : undefined,
        assertions: assert.length > 0 ? serialize(assert) : undefined,
        timeout: input.timeout || 45000,
        otelEndpoint: openTelemetry.endpoint,
        otelHeaders: otelHeadersEntries
          ? JSON.stringify(otelHeadersEntries)
          : undefined,
      })
      .returning()
      .get();

    const data = MonitorSchema.parse(_newMonitor);

    return c.json(data, 200);
  });
}
