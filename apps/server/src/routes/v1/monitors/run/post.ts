import { env } from "@/env";
import { openApiErrorResponses } from "@/libs/errors";
import { createRoute, z } from "@hono/zod-openapi";
import { and, eq, gte, isNull, sql } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { monitorRun } from "@openstatus/db/src/schema";
import { monitorStatusTable } from "@openstatus/db/src/schema/monitor_status/monitor_status";
import { selectMonitorStatusSchema } from "@openstatus/db/src/schema/monitor_status/validation";
import { monitor } from "@openstatus/db/src/schema/monitors/monitor";
import { selectMonitorSchema } from "@openstatus/db/src/schema/monitors/validation";
import type { httpPayloadSchema, tpcPayloadSchema } from "@openstatus/utils";
import { HTTPException } from "hono/http-exception";
import type { monitorsApi } from "..";
import { ParamsSchema, TriggerResult } from "../schema";

const triggerMonitor = createRoute({
  method: "post",
  tags: ["monitor"],
  description: "Run a monitor check",
  path: "/:id/run",
  request: {
    params: ParamsSchema,
    query: z
      .object({
        "no-wait": z.coerce
          .boolean()
          .optional()
          .openapi({
            description: "Don't wait for the result",
          })
          .default(false),
      })
      .openapi({}),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(TriggerResult),
        },
      },
      description: "All the historical metrics",
    },
    ...openApiErrorResponses,
  },
});

export function registerRunMonitor(api: typeof monitorsApi) {
  return api.openapi(triggerMonitor, async (c) => {
    const workspaceId = c.get("workspace").id;
    const { id } = c.req.valid("param");
    const limits = c.get("workspace").limits;
    const { "no-wait": noWait } = c.req.valid("query");
    const lastMonth = new Date().setMonth(new Date().getMonth() - 1);

    const count = (
      await db
        .select({ count: sql<number>`count(*)` })
        .from(monitorRun)
        .where(
          and(
            eq(monitorRun.workspaceId, workspaceId),
            gte(monitorRun.createdAt, new Date(lastMonth)),
          ),
        )
        .all()
    )[0].count;

    if (count >= limits["synthetic-checks"]) {
      throw new HTTPException(403, {
        message: "Upgrade for more checks",
      });
    }

    const monitorData = await db
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

    if (!monitorData) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    const parseMonitor = selectMonitorSchema.safeParse(monitorData);

    if (!parseMonitor.success) {
      throw new HTTPException(400, { message: "Something went wrong" });
    }

    const row = parseMonitor.data;

    // Maybe later overwrite the region

    const monitorStatusData = await db
      .select()
      .from(monitorStatusTable)
      .where(eq(monitorStatusTable.monitorId, monitorData.id))
      .all();

    const monitorStatus = z
      .array(selectMonitorStatusSchema)
      .safeParse(monitorStatusData);
    if (!monitorStatus.success) {
      console.log(monitorStatus.error);
      throw new HTTPException(400, { message: "Something went wrong" });
    }

    const timestamp = Date.now();

    const newRun = await db
      .insert(monitorRun)
      .values({
        monitorId: row.id,
        workspaceId: row.workspaceId,
        runnedAt: new Date(timestamp),
      })
      .returning();

    if (!newRun[0]) {
      throw new HTTPException(400, { message: "Something went wrong" });
    }

    const allResult = [];
    for (const region of parseMonitor.data.regions) {
      const status =
        monitorStatus.data.find((m) => region === m.region)?.status || "active";
      // Trigger the monitor

      let payload:
        | z.infer<typeof httpPayloadSchema>
        | z.infer<typeof tpcPayloadSchema>
        | null = null;
      //
      if (row.jobType === "http") {
        payload = {
          workspaceId: String(row.workspaceId),
          monitorId: String(row.id),
          url: row.url,
          method: row.method || "GET",
          cronTimestamp: timestamp,
          body: row.body,
          headers: row.headers,
          status: status,
          assertions: row.assertions ? JSON.parse(row.assertions) : null,
          degradedAfter: row.degradedAfter,
          timeout: row.timeout,
          trigger: "api",
        };
      }
      if (row.jobType === "tcp") {
        payload = {
          workspaceId: String(row.workspaceId),
          monitorId: String(row.id),
          uri: row.url,
          status: status,
          assertions: row.assertions ? JSON.parse(row.assertions) : null,
          cronTimestamp: timestamp,
          degradedAfter: row.degradedAfter,
          timeout: row.timeout,
          trigger: "api",
        };
      }

      if (!payload) {
        throw new Error("Invalid jobType");
      }
      const url = generateUrl({ row });
      const result = fetch(url, {
        headers: {
          "Content-Type": "application/json",
          "fly-prefer-region": region, // Specify the region you want the request to be sent to
          Authorization: `Basic ${env.CRON_SECRET}`,
        },
        method: "POST",
        body: JSON.stringify(payload),
      });
      allResult.push(result);
    }

    if (noWait) {
      return c.json([], 200);
    }

    const result = await Promise.all(allResult);
    // console.log(result);

    const bodies = await Promise.all(result.map((r) => r.json()));
    // let data = null;

    const data = z.array(TriggerResult).safeParse(bodies);

    if (!data) {
      throw new HTTPException(400, { message: "Something went wrong" });
    }

    if (!data.success) {
      console.log(data.error);
      throw new HTTPException(400, { message: "Something went wrong" });
    }

    return c.json(data.data, 200);
  });
}

function generateUrl({ row }: { row: z.infer<typeof selectMonitorSchema> }) {
  switch (row.jobType) {
    case "http":
      return `https://openstatus-checker.fly.dev/checker/http?monitor_id=${row.id}&trigger=api&data=true`;
    case "tcp":
      return `https://openstatus-checker.fly.dev/checker/tcp?monitor_id=${row.id}&trigger=api&data=true`;
    default:
      throw new Error("Invalid jobType");
  }
}
