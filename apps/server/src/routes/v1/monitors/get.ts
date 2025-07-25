import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import type { monitorsApi } from "./index";
import { MonitorSchema, ParamsSchema } from "./schema";

const getRoute = createRoute({
  method: "get",
  tags: ["monitor"],
  summary: "Get a monitor",
  path: "/{id}",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MonitorSchema,
        },
      },
      description: "The monitor",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetMonitor(api: typeof monitorsApi) {
  return api.openapi(getRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const { id } = c.req.valid("param");

    const _monitor = await db
      .select()
      .from(monitor)
      .where(
        and(
          eq(monitor.id, Number(id)),
          eq(monitor.workspaceId, workspaceId),
          isNull(monitor.deletedAt),
        ),
      )
      .get();

    if (!_monitor) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Monitor ${id} not found`,
      });
    }
    const otelHeader = _monitor.otelHeaders
      ? z
          .array(
            z.object({
              key: z.string(),
              value: z.string(),
            }),
          )
          .parse(JSON.parse(_monitor.otelHeaders))
          // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
          .reduce((a, v) => ({ ...a, [v.key]: v.value }), {})
      : undefined;

    const data = MonitorSchema.parse({
      ..._monitor,
      openTelemetry: _monitor.otelEndpoint
        ? {
            headers: otelHeader,
            endpoint: _monitor.otelEndpoint ?? undefined,
          }
        : undefined,
    });

    return c.json(data, 200);
  });
}
