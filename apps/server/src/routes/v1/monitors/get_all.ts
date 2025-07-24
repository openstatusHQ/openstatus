import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { openApiErrorResponses } from "@/libs/errors";
import type { monitorsApi } from "./index";
import { MonitorSchema } from "./schema";

const getAllRoute = createRoute({
  method: "get",
  tags: ["monitor"],
  summary: "List all monitors",
  path: "/",
  request: {},
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(MonitorSchema),
        },
      },
      description: "All the monitors",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetAllMonitors(app: typeof monitorsApi) {
  return app.openapi(getAllRoute, async (c) => {
    const workspaceId = c.get("workspace").id;

    const _monitors = await db
      .select()
      .from(monitor)
      .where(
        and(eq(monitor.workspaceId, workspaceId), isNull(monitor.deletedAt)),
      )
      .all();

    const data = z.array(MonitorSchema).parse(
      _monitors.map((monitor) => {
        const otelHeader = monitor.otelHeaders
          ? z
              .array(
                z.object({
                  key: z.string(),
                  value: z.string(),
                }),
              )
              .parse(JSON.parse(monitor.otelHeaders))
              // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
              .reduce((a, v) => ({ ...a, [v.key]: v.value }), {})
          : undefined;
        return {
          ...monitor,
          openTelemetry: monitor.otelEndpoint
            ? {
                endpoint: monitor.otelEndpoint ?? undefined,
                headers: otelHeader,
              }
            : undefined,
        };
      }),
    );

    return c.json(data, 200);
  });
}
