import { Hono } from "hono";
import { z } from "zod";

import { and, db, eq, isNotNull } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema";
import { flyRegions } from "@openstatus/db/src/schema/monitors/constants";

import { env } from "../env";
import { checkerAudit } from "../utils/audit-log";
import { triggerAlerting } from "./alerting";

export const checkerRoute = new Hono();

checkerRoute.post("/updateStatus", async (c) => {
  const auth = c.req.header("Authorization");
  if (auth !== `Basic ${env.CRON_SECRET}`) {
    console.error("Unauthorized");
    return c.text("Unauthorized", 401);
  }

  const json = await c.req.json();
  const schema = z.object({
    monitorId: z.string(),
    message: z.string().optional(),
    statusCode: z.number().optional(),
    region: z.enum(flyRegions),
  });

  const result = schema.safeParse(json);
  if (!result.success) {
    // console.error(result.error);
    return c.text("Unprocessable Entity", 422);
  }
  const { monitorId, message, region, statusCode } = result.data;

  console.log(`📝 update monitor status ${JSON.stringify(result.data)}`);

  // we check if it's an error
  // If status  not in 200>  and <300
  // if there's no  incident create one and notify
  // publish event to TB

  // if status is ok  checked if there's an open incident
  // if open incident publish incident recovered
  const incident = await db
    .select()
    .from(incidentTable)
    .where(
      and(
        eq(incidentTable.monitorId, Number(monitorId)),
        isNotNull(incidentTable.resolvedAt),
      ),
    );

  // if we are in error
  if (statusCode && statusCode < 200 && statusCode > 300) {
    // create incident
    // trigger alerting
    await checkerAudit.publishAuditLog({
      id: `monitor:${monitorId}`,
      action: "monitor.failed",
      targets: [{ id: monitorId, type: "monitor" }],
      metadata: {
        region: region,
        statusCode: statusCode,
        message,
      },
    });
    if (!incident) {
      await db.insert(incidentTable).values({
        monitorId: Number(monitorId),
        startedAt: new Date(),
      });
      await triggerAlerting({
        monitorId: monitorId,
        region: env.FLY_REGION,
        statusCode,
        message,
      });
    }
  } else {
    if (incident) {
      await checkerAudit.publishAuditLog({
        id: `monitor:${monitorId}`,
        action: "monitor.recovered",
        targets: [{ id: monitorId, type: "monitor" }],
        metadata: { region: region, statusCode: Number(statusCode) },
      });
    }
    // if there's no incident we should do nothing
    // our status is ok
  }

  return c.text("Ok", 200);
});
