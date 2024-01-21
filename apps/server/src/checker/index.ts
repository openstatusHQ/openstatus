import { Hono } from "hono";
import { z } from "zod";

import { eq, schema } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
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
    status: z.enum(["active", "error"]), // that's the new status
    message: z.string().optional(),
    statusCode: z.number().optional(),
    region: z.enum(flyRegions),
    cronTimestamp: z.number().optional(),
  });

  const result = payloadSchema.safeParse(json);
  if (!result.success) {
    // console.error(result.error);
    return c.text("Unprocessable Entity", 422);
  }
  const { monitorId, status, message, region, statusCode, cronTimestamp } =
    result.data;

  console.log(`📝 update monitor status ${JSON.stringify(result.data)}`);

  switch (status) {
    case "active":
      if (!statusCode) {
        return;
      }
      await upsertMonitorStatus({
        monitorId: monitorId,
        status: "active",
        region: region,
      });

      await checkerAudit.publishAuditLog({
        id: `monitor:${monitorId}`,
        action: "monitor.recovered",
        targets: [{ id: monitorId, type: "monitor" }],
        metadata: {
          region: region,
          statusCode: statusCode,
          cronTimestamp: cronTimestamp,
        },
      });
      break;
    case "error": {
      await upsertMonitorStatus({
        monitorId: monitorId,
        status: "error",
        region: region,
      });
      // ALPHA
      await checkerAudit.publishAuditLog({
        id: `monitor:${monitorId}`,
        action: "monitor.failed",
        targets: [{ id: monitorId, type: "monitor" }],
        metadata: {
          region: region,
          statusCode: statusCode,
          message,
          cronTimestamp,
        },
      });

      const currentMonitor = await db
        .select()
        .from(schema.monitor)
        .where(eq(schema.monitor.id, Number(monitorId)))
        .get();

      const monitor = selectMonitorSchema.parse(currentMonitor);

      if (!cronTimestamp) {
        console.log("cronTimestamp is undefined");
      }

      const redisKey = `${monitorId}-${cronTimestamp}`;
      // We add the new region to the set
      await redis.sadd(redisKey, region);
      // let's add an expire to the set
      await redis.expire(redisKey, 60 * 60 * 24);
      // We get the number of regions affected
      const nbAffectedRegion = await redis.scard(redisKey);

      // If the number of affected regions is greater than half of the total region, we  trigger the alerting
      if (nbAffectedRegion < monitor.regions.length / 2) {
        console.log(
          `Not enough affected regions (${nbAffectedRegion}/${flyRegions.length})`,
        );
        break;
      }
      // Add  a
      await triggerAlerting({
        monitorId: monitorId,
        region: env.FLY_REGION,
        statusCode,
        message,
      });
      break;
    }
  }
  return c.text("Ok", 200);
});
