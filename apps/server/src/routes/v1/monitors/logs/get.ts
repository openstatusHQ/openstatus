import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { tb } from "@/libs/clients";
import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import type { monitorsApi } from "../index";
import { ParamsSchema, ResponseLogDetail } from "../schema";
import { checkResponseLogsLimit, redactSensitiveHeaders } from "./utils";

const getRoute = createRoute({
  method: "get",
  tags: ["monitor"],
  summary: "Get a monitor response log",
  description:
    "Get a single scheduled response log for an HTTP monitor, including response headers, body, assertions, and timing phases.",
  path: "/{id}/logs/{logId}",
  request: {
    params: ParamsSchema.extend({
      logId: z.string().openapi({
        description: "The response log id.",
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: ResponseLogDetail,
          }),
        },
      },
      description: "The response log.",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetMonitorLog(api: typeof monitorsApi) {
  return api.openapi(getRoute, async (c) => {
    const workspace = c.get("workspace");
    const workspaceId = workspace.id;
    const { id, logId } = c.req.valid("param");

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

    const result = await tb.httpGetBiweekly({
      id: logId,
      monitorId: id,
    });
    const log = result.data[0];

    if (!log) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Response log ${logId} not found`,
      });
    }

    const { workspaceId: _workspaceId, ...publicLog } = log;

    return c.json(
      {
        data: {
          ...publicLog,
          headers: redactSensitiveHeaders(log.headers),
        },
      },
      200,
    );
  });
}
