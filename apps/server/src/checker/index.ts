import { Hono } from "hono";
import { z } from "zod";

import { flyRegions } from "@openstatus/db/src/schema/monitors/constants";

import { env } from "../env";
import { checkerAudit } from "../utils/audit-log";
import { triggerAlerting, upsertMonitorStatus } from "./alerting";

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
    status: z.enum(["active", "error"]), // that's the new status
    message: z.string().optional(),
    statusCode: z.number().optional(),
    region: z.enum(flyRegions),
  });

  const result = schema.safeParse(json);
  if (!result.success) {
    // console.error(result.error);
    return c.text("Unprocessable Entity", 422);
  }
  const { monitorId, status, message, region, statusCode } = result.data;

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
        metadata: { region: region, statusCode: statusCode },
      });
      break;
    case "error":
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
        },
      });
      await triggerAlerting({
        monitorId: monitorId,
        region: env.FLY_REGION,
        statusCode,
        message,
      });
      break;
  }
  return c.text("Ok", 200);
});
