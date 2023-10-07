import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import {
  availableStatus,
  incident,
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
  status: z.enum(availableStatus).openapi({
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
  status: z.enum(availableStatus).openapi({
    description: "The current status of the incident",
  }),
});

const getAllRoute = createRoute({
  method: "get",
  tags: ["incident"],
  path: "/",
  request: {},
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(incidentSchema),
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

  const _incidents = await db
    .select()
    .from(incident)
    .where(eq(incident.workspaceId, workspaceId))
    .all();

  if (!_incidents) return c.jsonT({ code: 404, message: "Not Found" });

  const data = z.array(incidentSchema).parse(_incidents);

  return c.jsonT(data);
});

const getRoute = createRoute({
  method: "get",
  tags: ["incident"],
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: incidentSchema,
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
  const _incident = await db
    .select()
    .from(incident)
    .where(eq(incident.id, incidentId))
    .get();

  if (!_incident) return c.jsonT({ code: 404, message: "Not Found" });

  if (workspaceId !== _incident.workspaceId)
    return c.jsonT({ code: 401, message: "Unauthorized" });

  const data = incidentSchema.parse(_incident);

  return c.jsonT(data);
});

const postRoute = createRoute({
  method: "post",
  tags: ["incident"],
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
      description: "Create  a monitor",
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
      description: "Delete the incident",
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
  request: {
    params: ParamsSchema,
    body: {
      description: "The incident to create",
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
      description: "Create  a monitor",
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
