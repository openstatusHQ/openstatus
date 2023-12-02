import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import {
  statusReport,
  statusReportStatus,
  statusReportUpdate,
} from "@openstatus/db/src/schema";

import type { Variables } from ".";
import { ErrorSchema } from "./shared";

const statusReportUpdateApi = new OpenAPIHono<{ Variables: Variables }>();

const ParamsSelectSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      description: "The id of the update",
      example: "1",
    }),
});

export const statusUpdateSchema = z.object({
  status: z.enum(statusReportStatus).openapi({
    description: "The status of the update",
  }),
  id: z.coerce.string().openapi({ description: "The id of the update" }),
  date: z
    .preprocess((val) => String(val), z.string())
    .openapi({
      description: "The date of the update in ISO 8601 format",
    }),
  message: z.string().openapi({
    description: "The message of the update",
  }),
});

const createStatusReportUpdateSchema = z.object({
  status_report_id: z.number().openapi({
    description: "The id of the status report",
  }),
  status: z.enum(statusReportStatus).openapi({
    description: "The status of the update",
  }),
  date: z.string().datetime().openapi({
    description: "The date of the update in ISO 8601 format",
  }),
  message: z.string().openapi({
    description: "The message of the update",
  }),
});
const getUpdateRoute = createRoute({
  method: "get",
  tags: ["status_report_update"],
  path: "/:id",
  request: {
    params: ParamsSelectSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: statusUpdateSchema,
        },
      },
      description: "Get all status report updates",
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

statusReportUpdateApi.openapi(getUpdateRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  const update = await db
    .select()
    .from(statusReportUpdate)
    .where(eq(statusReportUpdate.id, Number(id)))
    .get();

  if (!update) return c.jsonT({ code: 404, message: "Not Found" });

  const currentStatusReport = await db
    .select()
    .from(statusReport)
    .where(
      and(
        eq(statusReport.id, update.statusReportId),
        eq(statusReport.workspaceId, workspaceId),
      ),
    )
    .get();
  if (!currentStatusReport)
    return c.jsonT({ code: 401, message: "Not Authorized" });

  const data = statusUpdateSchema.parse(update);

  return c.jsonT(data);
});

const createStatusUpdate = createRoute({
  method: "post",
  tags: ["status_report_update"],
  path: "/",
  request: {
    body: {
      description: "the status report update",
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
      description: "Get all status report updates",
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

statusReportUpdateApi.openapi(createStatusUpdate, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const input = c.req.valid("json");

  const _currentStatusReport = await db
    .select()
    .from(statusReport)
    .where(
      and(
        eq(statusReport.id, input.status_report_id),
        eq(statusReport.workspaceId, workspaceId),
      ),
    )
    .get();
  if (!_currentStatusReport)
    return c.jsonT({ code: 401, message: "Not Authorized" });

  const res = await db
    .insert(statusReportUpdate)
    .values({
      ...input,
      date: new Date(input.date),
      statusReportId: input.status_report_id,
    })
    .returning()
    .get();

  const data = statusUpdateSchema.parse(res);
  return c.jsonT(data);
});

export { statusReportUpdateApi };
