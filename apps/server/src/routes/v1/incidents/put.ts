import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema/incidents";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { Events } from "@openstatus/analytics";
import { trackMiddleware } from "../middleware";
import type { incidentsApi } from "./index";
import { IncidentSchema, ParamsSchema } from "./schema";

const putRoute = createRoute({
  method: "put",
  tags: ["incident"],
  description: "Update an incident",
  path: "/:id",
  middleware: [trackMiddleware(Events.UpdateIncident)],
  request: {
    params: ParamsSchema,
    body: {
      description: "The incident to update",
      content: {
        "application/json": {
          schema: IncidentSchema.pick({
            acknowledgedAt: true,
            resolvedAt: true,
          })
            // TODO: check if really necessary
            .extend({
              acknowledgedAt: z.coerce.date().optional(),
              resolvedAt: z.coerce.date().optional(),
            })
            .openapi({
              description: "The incident to update",
            }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: IncidentSchema,
        },
      },
      description: "Update a monitor",
    },
    ...openApiErrorResponses,
  },
});

export function registerPutIncident(app: typeof incidentsApi) {
  return app.openapi(putRoute, async (c) => {
    const inputValues = c.req.valid("json");
    const workspaceId = c.get("workspace").id;
    const { id } = c.req.valid("param");

    const _incident = await db
      .select()
      .from(incidentTable)
      .where(
        and(
          eq(incidentTable.id, Number(id)),
          eq(incidentTable.workspaceId, workspaceId),
        ),
      )
      .get();

    if (!_incident) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Incident ${id} not found`,
      });
    }

    const _newIncident = await db
      .update(incidentTable)
      // TODO: we should set the acknowledgedBy and resolvedBy fields
      .set({ ...inputValues })
      .where(eq(incidentTable.id, Number(id)))
      .returning()
      .get();

    const data = IncidentSchema.parse(_newIncident);

    return c.json(data, 200);
  });
}
