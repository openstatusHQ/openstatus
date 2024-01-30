import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { and, db, eq, isNotNull } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema/incidents";

import type { Variables } from "./index";
import { ErrorSchema } from "./shared";

const incidentsApi = new OpenAPIHono<{ Variables: Variables }>();

const ParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      description: "The id of the Incident",
      example: "1",
    }),
});

const IncidentSchema = z.object({
  id: z.number().openapi({
    description: "The id of the incident",
    example: 1,
  }),
  startedAt: z.string().openapi({
    description: "The date the incident started",
  }),

  monitorId: z
    .number()
    .openapi({
      description: "The id of the monitor associated with the incident",
      example: 1,
    })
    .optional(),

  acknowledgedAt: z
    .string()
    .openapi({
      description: "The date the incident was acknowledged",
    })
    .optional(),

  acknowledgedBy: z
    .number()
    .openapi({
      description: "The user who acknowledged the incident",
    })
    .optional(),

  resolvedAt: z
    .string()
    .openapi({
      description: "The date the incident was resolved",
    })
    .optional(),
  resolvedBy: z
    .number()
    .openapi({
      description: "The user who resolved the incident",
    })
    .optional(),
});

const getAllRoute = createRoute({
  method: "get",
  tags: ["incident"],
  description: "Get all incidents",
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
    400: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
  },
});

incidentsApi.openapi(getAllRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const result = await db
    .select()
    .from(incidentTable)
    .where(eq(incidentTable.workspaceId, workspaceId))
    .all();

  if (!result) return c.jsonT({ code: 404, message: "Not Found" });

  const data = z.array(IncidentSchema).parse(result);
  return c.jsonT(data);
});

const getRoute = createRoute({
  method: "get",
  tags: ["incident"],
  description: "Get an incident report",
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: IncidentSchema,
        },
      },
      description: "Get an single incident reports",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
  },
});

incidentsApi.openapi(getRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  const incidentId = Number(id);
  const result = await db
    .select()
    .from(incidentTable)
    .where(eq(incidentTable.workspaceId, workspaceId), eq(incidentTable.id, incidentId));
    .get()

  if (!result) return c.jsonT({ code: 404, message: "Not Found" });
  const data = IncidentSchema.parse(result);

  return c.jsonT(data);
});


export { incidentsApi };
