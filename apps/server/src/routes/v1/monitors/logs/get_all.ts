import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { tb } from "@/libs/clients";
import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import type { monitorsApi } from "../index";
import { ParamsSchema, ResponseLogListItem } from "../schema";
import { checkResponseLogsLimit } from "./utils";

const QuerySchema = z.object({
  from: z.coerce.date().optional().openapi({
    description: "Start of the response log window.",
  }),
  to: z.coerce.date().optional().openapi({
    description: "End of the response log window.",
  }),
  limit: z.coerce.number().int().min(1).max(100).default(25).openapi({
    description: "Maximum number of response logs to return.",
    example: 25,
  }),
  offset: z.coerce.number().int().min(0).default(0).openapi({
    description: "Number of response logs to skip.",
    example: 0,
  }),
});

const getRoute = createRoute({
  method: "get",
  tags: ["monitor"],
  summary: "List monitor response logs",
  description:
    "List recent response logs for an HTTP monitor. These are the same scheduled response logs shown in the dashboard Logs tab.",
  path: "/{id}/logs",
  request: {
    params: ParamsSchema,
    query: QuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: ResponseLogListItem.array(),
            pagination: z.object({
              limit: z.int(),
              offset: z.int(),
              hasMore: z.boolean(),
              nextOffset: z.int().nullable(),
            }),
          }),
        },
      },
      description: "Response logs for the monitor.",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetMonitorLogs(api: typeof monitorsApi) {
  return api.openapi(getRoute, async (c) => {
    const workspace = c.get("workspace");
    const workspaceId = workspace.id;
    const { id } = c.req.valid("param");
    const { from, to, limit, offset } = c.req.valid("query");

    checkResponseLogsLimit(workspace.limits);

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

    if (_monitor.jobType !== "http") {
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message: "Response logs are currently only supported for HTTP monitors",
      });
    }

    const result = await tb.httpListBiweekly({
      monitorId: id,
      fromDate: from?.getTime(),
      toDate: to?.getTime(),
      limit: limit + 1,
      offset,
    });
    const data = result.data.slice(0, limit);
    const hasMore = result.data.length > limit;

    return c.json(
      {
        data,
        pagination: {
          limit,
          offset,
          hasMore,
          nextOffset: hasMore ? offset + limit : null,
        },
      },
      200,
    );
  });
}
