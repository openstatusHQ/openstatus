import { createRoute, z } from "@hono/zod-openapi";

import { db, eq } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema/incidents";

import { HTTPException } from "hono/http-exception";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import type { incidentsApi } from "./index";
import { IncidentSchema } from "./schema";

const getAllRoute = createRoute({
  method: "get",
  tags: ["incident"],
  description: "Get all Incidents",
  path: "/",
  request: {},
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(IncidentSchema),
        },
      },
      description: "Get all incidents",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetAllIncidents(app: typeof incidentsApi) {
  app.openapi(getAllRoute, async (c) => {
    const workspaceId = c.get("workspaceId");

    const _incidents = await db
      .select()
      .from(incidentTable)
      .where(eq(incidentTable.workspaceId, Number(workspaceId)))
      .all();

    if (!_incidents) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    const returnValues = z.array(IncidentSchema).parse(_incidents); // TODO: think of using safeParse with SchemaError.fromZod
    return c.json(returnValues, 200);
  });
}
