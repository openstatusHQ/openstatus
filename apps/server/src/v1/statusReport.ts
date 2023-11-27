import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import {
  statusReport,
  statusReportStatus,
  statusReportUpdate,
} from "@openstatus/db/src/schema";

import type { Variables } from "./index";
import { ErrorSchema } from "./shared";
import { statusUpdateSchema } from "./statusReportUpdate";

const statusApi = new OpenAPIHono<{ Variables: Variables }>();

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

const createStatusReportUpdateSchema = z.object({
  status: z.enum(statusReportStatus).openapi({
    description: "The status of the update",
  }),
  date: z.string().openapi({
    description: "The date of the update in ISO 8601 format",
  }),
  message: z.string().openapi({
    description: "The message of the update",
  }),
});

const statusSchema = z.object({
  title: z.string().openapi({
    example: "Documenso",
    description: "The title of the status report",
  }),
  status: z.enum(statusReportStatus).openapi({
    description: "The current status of the incident",
  }),
});

const statusReportExtendedSchema = statusSchema.extend({
  id: z.number().openapi({ description: "The id of the incident" }),
  status_updates: z
    .array(z.number())
    .openapi({
      description: "The ids of the incident updates",
    })
    .default([]),
});
const getAllRoute = createRoute({
  method: "get",
  tags: ["status"],
  description: "Get all incidents",
  path: "/",
  request: {},
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(statusReportExtendedSchema),
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

statusApi.openapi(getAllRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const _statusReports = await db.query.statusReport.findMany({
    with: {
      statusReportUpdates: true,
    },
    where: eq(statusReport.workspaceId, workspaceId),
  });

  if (!_statusReports) return c.jsonT({ code: 404, message: "Not Found" });

  const data = z.array(statusReportExtendedSchema).parse(
    _statusReports.map((statusReport) => ({
      ...statusReport,
      incident_updates: statusReport.statusReportUpdates.map(
        (statusReportUpdate) => {
          return statusReportUpdate.id;
        },
      ),
    })),
  );

  return c.jsonT(data);
});

const getRoute = createRoute({
  method: "get",
  tags: ["status"],
  description: "Get an incident",
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: statusReportExtendedSchema,
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

statusApi.openapi(getRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  const statusUpdateId = Number(id);
  const _statusUpdate = await db.query.statusReport.findFirst({
    with: {
      statusReportUpdates: true,
    },
    where: and(
      eq(statusReport.workspaceId, workspaceId),
      eq(statusReport.id, statusUpdateId),
    ),
  });

  if (!_statusUpdate) return c.jsonT({ code: 404, message: "Not Found" });
  const data = statusReportExtendedSchema.parse({
    ..._statusUpdate,
    status_report_updates: _statusUpdate.statusReportUpdates.map(
      (incidentUpdate) => incidentUpdate.id,
    ),
  });

  return c.jsonT(data);
});

const postRoute = createRoute({
  method: "post",
  tags: ["status"],
  description: "Create an incident",
  path: "/",
  request: {
    body: {
      description: "The incident to create",
      content: {
        "application/json": {
          schema: statusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: statusReportExtendedSchema,
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

statusApi.openapi(postRoute, async (c) => {
  const input = c.req.valid("json");
  const workspaceId = Number(c.get("workspaceId"));

  const _newIncident = await db
    .insert(statusReport)
    .values({
      ...input,
      workspaceId: workspaceId,
    })
    .returning()
    .get();

  const data = statusReportExtendedSchema.parse(_newIncident);

  return c.jsonT(data);
});

const deleteRoute = createRoute({
  method: "delete",
  tags: ["status"],
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

statusApi.openapi(deleteRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  const statusReportId = Number(id);
  const _statusReport = await db
    .select()
    .from(statusReport)
    .where(eq(statusReport.id, statusReportId))
    .get();

  if (!_statusReport) return c.jsonT({ code: 404, message: "Not Found" });

  if (workspaceId !== _statusReport.workspaceId)
    return c.jsonT({ code: 401, message: "Unauthorized" });

  await db
    .delete(statusReport)
    .where(eq(statusReport.id, statusReportId))
    .run();
  return c.jsonT({ message: "Deleted" });
});

const postRouteUpdate = createRoute({
  method: "post",
  tags: ["status"],
  path: "/:id/update",
  description: "Create an incident update",
  request: {
    params: ParamsSchema,
    body: {
      description: "the incident update",
      content: {
        "application/json": {
          schema: createStatusReportUpdateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: statusUpdateSchema,
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

statusApi.openapi(postRouteUpdate, async (c) => {
  const input = c.req.valid("json");
  const { id } = c.req.valid("param");
  const workspaceId = Number(c.get("workspaceId"));

  const statusReportId = Number(id);
  const _incident = await db
    .select()
    .from(statusReport)
    .where(
      and(
        eq(statusReport.id, statusReportId),
        eq(statusReport.workspaceId, workspaceId),
      ),
    )
    .get();

  if (!_incident) return c.jsonT({ code: 401, message: "Not authorized" });

  const _incidentUpdate = await db
    .insert(statusReportUpdate)
    .values({
      ...input,
      date: new Date(input.date),
      statusReportId: Number(id),
    })
    .returning()
    .get();

  const data = statusUpdateSchema.parse(_incidentUpdate);

  return c.jsonT({
    ...data,
  });
});

export { statusApi };
