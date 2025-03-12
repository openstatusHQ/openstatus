import { Client } from "@upstash/qstash";

import { Hono } from "hono";
import { z } from "zod";

import { and, count, db, eq, isNull, schema } from "@openstatus/db";
import { incidentTable, workspace } from "@openstatus/db/src/schema";
import {
  monitorStatusSchema,
  selectMonitorSchema,
} from "@openstatus/db/src/schema/monitors/validation";

import { flyRegions } from "@openstatus/db/src/schema/constants";
import { Tinybird } from "@openstatus/tinybird";
import { env } from "../env";
import { checkerAudit } from "../utils/audit-log";
import { triggerNotifications, upsertMonitorStatus } from "./alerting";

export const checkerRoute = new Hono();

const tb = new Tinybird({ token: env().TINY_BIRD_API_KEY });

const payloadSchema = z.object({
  monitorId: z.string(),
  message: z.string().optional(),
  statusCode: z.number().optional(),
  region: z.enum(flyRegions),
  cronTimestamp: z.number(),
  status: monitorStatusSchema,
  latency: z.number().optional(),
});

const publishStatus = tb.buildIngestEndpoint({
  datasource: "alerts__v0",
  event: payloadSchema,
});

checkerRoute.post("/updateStatus", async (c) => {
  const auth = c.req.header("Authorization");
  if (auth !== `Basic ${env().CRON_SECRET}`) {
    console.error("Unauthorized");
    return c.text("Unauthorized", 401);
  }

  const json = await c.req.json();

  const result = payloadSchema.safeParse(json);

  if (!result.success) {
    return c.text("Unprocessable Entity", 422);
  }
  const {
    monitorId,
    message,
    region,
    statusCode,
    cronTimestamp,
    status,
    latency,
  } = result.data;

  console.log(`📝 update monitor status ${JSON.stringify(result.data)}`);

  // First we upsert the monitor status
  await upsertMonitorStatus({
    monitorId: monitorId,
    status,
    region: region,
  });
  await publishStatus(result.data);

  const currentMonitor = await db
    .select()
    .from(schema.monitor)
    .where(eq(schema.monitor.id, Number(monitorId)))
    .get();

  const monitor = selectMonitorSchema.parse(currentMonitor);
  const numberOfRegions = monitor.regions.length;

  const affectedRegion = await db
    .select({ count: count() })
    .from(schema.monitorStatusTable)
    .where(
      and(
        eq(schema.monitorStatusTable.monitorId, monitor.id),
        eq(schema.monitorStatusTable.status, status),
      ),
    )
    .get();

  if (!affectedRegion?.count) {
    return c.json({ success: true }, 200);
  }

  if (affectedRegion.count >= numberOfRegions / 2 || numberOfRegions === 1) {
    switch (status) {
      case "active": {
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

        if (!incident) {
          // it was just a single failure not a proper incident
          break;
        }
        if (incident?.resolvedAt) {
          // incident is already resolved
          break;
        }

        console.log(`🤓 recovering incident ${incident.id}`);
        await db
          .update(incidentTable)
          .set({
            resolvedAt: new Date(cronTimestamp),
            autoResolved: true,
          })
          .where(eq(incidentTable.id, incident.id))
          .run();

        await db
          .update(schema.monitor)
          .set({ status: "active" })
          .where(eq(schema.monitor.id, monitor.id));

        await triggerNotifications({
          monitorId,
          statusCode,
          message,
          notifType: "recovery",
          cronTimestamp,
          region,
          latency,
          incidentId: `${cronTimestamp}`,
        });

        await checkerAudit.publishAuditLog({
          id: `monitor:${monitorId}`,
          action: "monitor.recovered",
          targets: [{ id: monitorId, type: "monitor" }],
          metadata: { region: region, statusCode: statusCode ?? -1 },
        });

        break;
      }
      case "degraded":
        if (monitor.status !== "degraded") {
          console.log(
            `🔄 update monitorStatus ${monitor.id} status: DEGRADED}`,
          );
          await db
            .update(schema.monitor)
            .set({ status: "degraded" })
            .where(eq(schema.monitor.id, monitor.id));
          // figure how to send the notification once
          await triggerNotifications({
            monitorId,
            statusCode,
            message,
            notifType: "degraded",
            cronTimestamp,
            latency,
            region,
            incidentId: `${cronTimestamp}`,
          });
        }
        await checkerAudit.publishAuditLog({
          id: `monitor:${monitorId}`,
          action: "monitor.degraded",
          targets: [{ id: monitorId, type: "monitor" }],
          metadata: { region, statusCode: statusCode ?? -1 },
        });
        break;
      case "error":
        try {
          const newIncident = await db
            .insert(incidentTable)
            .values({
              monitorId: Number(monitorId),
              workspaceId: monitor.workspaceId,
              startedAt: new Date(cronTimestamp),
            })
            .returning();

          if (!newIncident[0].id) {
            return;
          }
          await triggerNotifications({
            monitorId,
            statusCode,
            message,
            notifType: "alert",
            cronTimestamp,
            latency,
            region,
            incidentId: String(newIncident[0].id),
          });

          await db
            .update(schema.monitor)
            .set({ status: "error" })
            .where(eq(schema.monitor.id, monitor.id));

          if (monitor && monitor.jobType === "http" && monitor.workspaceId) {
            const currentWorkspace = await db
              .select()
              .from(workspace)
              .where(eq(workspace.id, monitor.workspaceId))
              .get();
            if (!!currentWorkspace?.plan && currentWorkspace?.plan !== "free") {
              await triggerScreenshot({
                data: {
                  url: monitor.url,
                  incidentId: newIncident[0].id,
                  kind: "incident",
                },
              });
            }
          }
          await checkerAudit.publishAuditLog({
            id: `monitor:${monitorId}`,
            action: "monitor.failed",
            targets: [{ id: monitorId, type: "monitor" }],
            metadata: { region, statusCode, message },
          });
        } catch {
          console.log("incident was already created");
        }
        break;
      default:
        console.log("should not happen");
        break;
    }
  }

  // if we are in error
  return c.text("Ok", 200);
});

const payload = z.object({
  url: z.string().url(),
  incidentId: z.number(),
  kind: z.enum(["incident", "recovery"]),
});

const triggerScreenshot = async ({
  data,
}: {
  data: z.infer<typeof payload>;
}) => {
  console.log(` 📸 taking screenshot for incident ${data.incidentId}`);

  const client = new Client({ token: env().QSTASH_TOKEN });

  await client.publishJSON({
    url: env().SCREENSHOT_SERVICE_URL,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": `Basic ${env().CRON_SECRET}`,
    },
    body: {
      url: data.url,
      incidentId: data.incidentId,
      kind: data.kind,
    },
  });
};
