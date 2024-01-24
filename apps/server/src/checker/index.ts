import { Hono } from "hono";
import { z } from "zod";

import { and, db, eq, isNull, schema } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema";
import { flyRegions } from "@openstatus/db/src/schema/monitors/constants";
import { selectMonitorSchema } from "@openstatus/db/src/schema/monitors/validation";
import { Redis } from "@openstatus/upstash";

import { env } from "../env";
import { checkerAudit } from "../utils/audit-log";
import { triggerAlerting, upsertMonitorStatus } from "./alerting";

export const checkerRoute = new Hono();
const redis = Redis.fromEnv();

checkerRoute.post("/updateStatus", async (c) => {
  const auth = c.req.header("Authorization");
  if (auth !== `Basic ${env.CRON_SECRET}`) {
    console.error("Unauthorized");
    return c.text("Unauthorized", 401);
  }

  const json = await c.req.json();
  const payloadSchema = z.object({
    monitorId: z.string(),
    message: z.string().optional(),
    statusCode: z.number().optional(),
    region: z.enum(flyRegions),
    cronTimestamp: z.number(),
    // status: z.enum(["active", "error"]),
  });

  const result = payloadSchema.safeParse(json);
  if (!result.success) {
    return c.text("Unprocessable Entity", 422);
  }
  const { monitorId, message, region, statusCode, cronTimestamp } = result.data;

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
        isNull(incidentTable.resolvedAt),
        isNull(incidentTable.acknowledgedAt),
      ),
    )
    .get();

  // if we are in error
  if (!statusCode || (statusCode < 200 && statusCode > 300)) {
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
    // We upsert the status of the  monitor
    await upsertMonitorStatus({
      monitorId: monitorId,
      status: "error",
      region: region,
    });

    if (incident === undefined) {
      const redisKey = `${monitorId}-${cronTimestamp}-error`;
      // We add the new region to the set
      await redis.sadd(redisKey, region);
      // let's add an expire to the set
      await redis.expire(redisKey, 60 * 60 * 24);
      // We get the number of regions affected
      const nbAffectedRegion = await redis.scard(redisKey);

      const currentMonitor = await db
        .select()
        .from(schema.monitor)
        .where(eq(schema.monitor.id, Number(monitorId)))
        .get();

      const monitor = selectMonitorSchema.parse(currentMonitor);

      const numberOfRegions = monitor.regions.length;

      // If the number of affected regions is greater than half of the total region, we  trigger the alerting
      // 4 of 6 monitor need to fail to trigger an alerting
      if (nbAffectedRegion > numberOfRegions / 2) {
        // let's refetch the incident to avoid race condition
        const incident = await db
          .select()
          .from(incidentTable)
          .where(
            and(
              eq(incidentTable.monitorId, Number(monitorId)),
              isNull(incidentTable.resolvedAt),
              isNull(incidentTable.acknowledgedAt),
              eq(incidentTable.startedAt, new Date(cronTimestamp)),
            ),
          )
          .get();
        if (incident === undefined) {
          await db
            .insert(incidentTable)
            .values({
              monitorId: Number(monitorId),
              workspaceId: monitor.workspaceId,
              startedAt: new Date(cronTimestamp),
            })
            .onConflictDoNothing();

          await triggerAlerting({ monitorId, statusCode, message, region });
        }
      }
    }
  }
  // When the status is ok
  if (statusCode && statusCode >= 200 && statusCode < 300) {
    await upsertMonitorStatus({
      monitorId: monitorId,
      status: "active",
      region: region,
    });

    await checkerAudit.publishAuditLog({
      id: `monitor:${monitorId}`,
      action: "monitor.recovered",
      targets: [{ id: monitorId, type: "monitor" }],
      metadata: { region: region, statusCode: Number(statusCode) },
    });

    // FIX: TO BE IMPROVED
    // if (incident) {
    //   const redisKey = `${monitorId}-${cronTimestamp}-resolved`;
    //   // We add the new region to the set
    //   await redis.sadd(redisKey, region);
    //   // let's add an expire to the set
    //   await redis.expire(redisKey, 60 * 60 * 24);
    //   // We get the number of regions affected
    //   const nbAffectedRegion = await redis.scard(redisKey);

    //   const currentMonitor = await db
    //     .select()
    //     .from(schema.monitor)
    //     .where(eq(schema.monitor.id, Number(monitorId)))
    //     .get();

    //   const monitor = selectMonitorSchema.parse(currentMonitor);

    //   if (!cronTimestamp) {
    //     console.log("cronTimestamp is undefined");
    //   }

    //   const numberOfRegions = monitor.regions.length;

    //   // If the number of affected regions is greater than half of the total region, we  trigger the alerting
    //   // 4 of 6 monitor need to fail to trigger an alerting
    //   if (nbAffectedRegion > numberOfRegions / 2) {
    //     //  Trigger recovery notification
    //     // await triggerRecovery({ monitorId, statusCode, message, region });
    //     await db.update(incidentTable).set({
    //       resolvedAt: new Date(),
    //     });
    //   }
    // }
  }

  return c.text("Ok", 200);
});
