import { createRoute } from "@hono/zod-openapi";

import { db, eq } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema/incidents";

import { openApiErrorResponses } from "@/libs/errors";
import type { incidentsApi } from "./index";
import { IncidentSchema } from "./schema";

const getAllRoute = createRoute({
  method: "get",
  tags: ["incident"],
  summary: "List all incidents",
  path: "/",
  request: {},
  responses: {
    200: {
      content: {
        "application/json": {
          schema: IncidentSchema.array(),
        },
      },
      description: "Get all incidents",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetAllIncidents(app: typeof incidentsApi) {
  app.openapi(getAllRoute, async (c) => {
    const workspaceId = c.get("workspace").id;

    const _incidents = await db
      .select()
      .from(incidentTable)
      .where(eq(incidentTable.workspaceId, workspaceId))
      .all();

    const data = IncidentSchema.array().parse(_incidents);

    return c.json(data, 200);
  });
}
