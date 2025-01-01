import { env } from "@/env";
import { getCheckerPayload, getCheckerUrl } from "@/libs/checker";
import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { createRoute, z } from "@hono/zod-openapi";
import { and, eq, gte, isNull, sql } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { monitorRun } from "@openstatus/db/src/schema";
import { monitorStatusTable } from "@openstatus/db/src/schema/monitor_status/monitor_status";
import { selectMonitorStatusSchema } from "@openstatus/db/src/schema/monitor_status/validation";
import { monitor } from "@openstatus/db/src/schema/monitors/monitor";
import { selectMonitorSchema } from "@openstatus/db/src/schema/monitors/validation";
import { HTTPException } from "hono/http-exception";
import type { monitorsApi } from "..";
import { ParamsSchema, TriggerSchema } from "./schema";

const postRoute = createRoute({
  method: "post",
  tags: ["monitor"],
  summary: "Create a monitor trigger",
  description: "Trigger a monitor check without waiting the result",
  path: "/:id/trigger",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: TriggerSchema,
        },
      },
      description:
        "Returns a result id that can be used to get the result of your trigger",
    },
    ...openApiErrorResponses,
  },
});

export function registerTriggerMonitor(api: typeof monitorsApi) {
  return api.openapi(postRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const { id } = c.req.valid("param");
    const limits = c.get("workspace").limits;

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
      throw new OpenStatusApiError({
        code: "PAYMENT_REQUIRED",
        message: "Upgrade for more checks",
      });
    }

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

    const validateMonitor = selectMonitorSchema.safeParse(_monitor);

    if (!validateMonitor.success) {
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message: "Invalid monitor, please contact support",
      });
    }

    const row = validateMonitor.data;

    // Maybe later overwrite the region

    const _monitorStatus = await db
      .select()
      .from(monitorStatusTable)
      .where(eq(monitorStatusTable.monitorId, _monitor.id))
      .all();

    const monitorStatus = z
      .array(selectMonitorStatusSchema)
      .safeParse(_monitorStatus);

    if (!monitorStatus.success) {
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message: "Invalid monitor status, please contact support",
      });
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

    for (const region of validateMonitor.data.regions) {
      const status =
        monitorStatus.data.find((m) => region === m.region)?.status || "active";
      const payload = getCheckerPayload(row, status);
      const url = getCheckerUrl(row);

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

    await Promise.all(allResult);

    return c.json({ resultId: newRun[0].id }, 200);
  });
}
