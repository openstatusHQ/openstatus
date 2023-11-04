import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import {
  incident,
  incidentStatus,
  incidentUpdate,
} from "@openstatus/db/src/schema";

import type { Variables } from "./index";
import { ErrorSchema } from "./shared";

const incidentApi = new OpenAPIHono<{ Variables: Variables }>();

const ParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      description: "The id of the incident",
      example: "1",
    }),
});

const incidentUpdateSchema = z.object({
  status: z.enum(incidentStatus).openapi({
    description: "The status of the update",
  }),
  date: z.string().openapi({
    description: "The date of the update in ISO 8601 format",
  }),
  message: z.string().openapi({
    description: "The message of the update",
  }),
});

const incidentSchema = z.object({
  title: z.string().openapi({
    example: "Documenso",
    description: "The title of the incident",
  }),
  status: z.enum(incidentStatus).openapi({
    description: "The current status of the incident",
  }),
});

const incidentExtendedSchema = incidentSchema.extend({
  id: z.number().openapi({ description: "The id of the incident" }),
  incident_updates: z
    .array(z.number())
    .openapi({
      description: "The ids of the incident updates",
    })
    .default([]),
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
          schema: z.array(incidentExtendedSchema),
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

incidentApi.openapi(getAllRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const _incidents = await db.query.incident.findMany({
    with: {
      incidentUpdates: true,
    },
    where: eq(incident.workspaceId, workspaceId),
  });

  if (!_incidents) return c.jsonT({ code: 404, message: "Not Found" });

  const data = z.array(incidentExtendedSchema).parse(
    _incidents.map((incident) => ({
      ...incident,
      incident_updates: incident.incidentUpdates.map((incidentUpdate) => {
        return incidentUpdate.id;
      }),
    })),
  );

  return c.jsonT(data);
});

const getRoute = createRoute({
  method: "get",
  tags: ["incident"],
  description: "Get an incident",
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: incidentExtendedSchema,
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

incidentApi.openapi(getRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  const incidentId = Number(id);
  const _incident = await db.query.incident.findFirst({
    with: {
      incidentUpdates: true,
    },
    where: and(
      eq(incident.workspaceId, workspaceId),
      eq(incident.id, incidentId),
    ),
  });

  if (!_incident) return c.jsonT({ code: 404, message: "Not Found" });
  console.log(_incident);
  const data = incidentExtendedSchema.parse({
    ..._incident,
    incident_updates: _incident.incidentUpdates.map(
      (incidentUpdate) => incidentUpdate.id,
    ),
  });

  return c.jsonT(data);
});

const postRoute = createRoute({
  method: "post",
  tags: ["incident"],
  description: "Create an incident",
  path: "/",
  request: {
    body: {
      description: "The incident to create",
      content: {
        "application/json": {
          schema: incidentSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: incidentSchema,
        },
      },
      description: "Incident created",
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

incidentApi.openapi(postRoute, async (c) => {
  const input = c.req.valid("json");
  const workspaceId = Number(c.get("workspaceId"));

  const _newIncident = await db
    .insert(incident)
    .values({
      ...input,
      workspaceId: workspaceId,
    })
    .returning()
    .get();

  const data = incidentSchema.parse(_newIncident);

  return c.jsonT(data);
});

const deleteRoute = createRoute({
  method: "delete",
  tags: ["incident"],
  description: "Delete an incident",
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            message: z.string().openapi({
              example: "Deleted",
            }),
          }),
        },
      },
      description: "Incident deleted",
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

incidentApi.openapi(deleteRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  const incidentId = Number(id);
  const _incident = await db
    .select()
    .from(incident)
    .where(eq(incident.id, incidentId))
    .get();

  if (!_incident) return c.jsonT({ code: 404, message: "Not Found" });

  if (workspaceId !== _incident.workspaceId)
    return c.jsonT({ code: 401, message: "Unauthorized" });

  await db.delete(incident).where(eq(incident.id, incidentId)).run();
  return c.jsonT({ message: "Deleted" });
});

const postRouteUpdate = createRoute({
  method: "post",
  tags: ["incident"],
  path: "/:id/update",
  description: "Create an incident update",
  request: {
    params: ParamsSchema,
    body: {
      description: "the incident update",
      content: {
        "application/json": {
          schema: incidentUpdateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: incidentUpdateSchema,
        },
      },
      description: "Incident updated",
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

incidentApi.openapi(postRouteUpdate, async (c) => {
  const input = c.req.valid("json");
  const { id } = c.req.valid("param");
  const workspaceId = Number(c.get("workspaceId"));

  const incidentId = Number(id);
  const _incident = await db
    .select()
    .from(incident)
    .where(
      and(eq(incident.id, incidentId), eq(incident.workspaceId, workspaceId)),
    )
    .get();

  if (!_incident) return c.jsonT({ code: 401, message: "Not authorized" });

  const _incidentUpdate = await db
    .insert(incidentUpdate)
    .values({
      ...input,
      date: new Date(input.date),
      incidentId: Number(id),
    })
    .returning()
    .get();

  const data = incidentUpdateSchema.parse(_incidentUpdate);

  return c.jsonT({
    ...data,
  });
});

export { incidentApi };
