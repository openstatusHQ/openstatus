import { Client } from "@upstash/qstash";
import { Hono } from "hono";
import { z } from "zod";

import { and, db, eq, isNull, schema } from "@openstatus/db";
import { incidentTable, workspace } from "@openstatus/db/src/schema";
import {
  monitorStatusSchema,
  selectMonitorSchema,
} from "@openstatus/db/src/schema/monitors/validation";
import { Redis } from "@openstatus/upstash";

import { env } from "@/env";
import { checkerAudit } from "@/utils/audit-log";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { triggerNotifications, upsertMonitorStatus } from "./alerting";

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
    status: monitorStatusSchema,
  });

  const result = payloadSchema.safeParse(json);

  if (!result.success) {
    return c.text("Unprocessable Entity", 422);
  }
  const { monitorId, message, region, statusCode, cronTimestamp, status } =
    result.data;

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

  if (status === "degraded") {
    // We upsert the status of the  monitor
    await upsertMonitorStatus({
      monitorId: monitorId,
      status: "degraded",
      region: region,
    });
    await checkerAudit.publishAuditLog({
      id: `monitor:${monitorId}`,
      action: "monitor.degraded",
      targets: [{ id: monitorId, type: "monitor" }],
      metadata: { region, statusCode: statusCode ?? -1 },
    });
    const currentMonitor = await db
      .select()
      .from(schema.monitor)
      .where(eq(schema.monitor.id, Number(monitorId)))
      .get();
    if (currentMonitor?.status === "active") {
      const redisKey = `${monitorId}-${cronTimestamp}-degraded`;
      // We add the new region to the set
      await redis.sadd(redisKey, region);
      // let's add an expire to the set
      // We get the number of regions affected
      const nbAffectedRegion = await redis.scard(redisKey);
      await redis.expire(redisKey, 60 * 60 * 24);

      const monitor = selectMonitorSchema.parse(currentMonitor);

      const numberOfRegions = monitor.regions.length;

      if (nbAffectedRegion >= numberOfRegions / 2 || numberOfRegions === 1) {
        await triggerNotifications({
          monitorId,
          statusCode,
          message,
          notifType: "degraded",
          cronTimestamp,
          incidentId: `${cronTimestamp}`,
        });
      }
    }
  }
  // if we are in error
  if (status === "error") {
    // trigger alerting
    await checkerAudit.publishAuditLog({
      id: `monitor:${monitorId}`,
      action: "monitor.failed",
      targets: [{ id: monitorId, type: "monitor" }],
      metadata: { region, statusCode, message },
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
      // We get the number of regions affected
      const nbAffectedRegion = await redis.scard(redisKey);
      await redis.expire(redisKey, 60 * 60 * 24);

      const currentMonitor = await db
        .select()
        .from(schema.monitor)
        .where(eq(schema.monitor.id, Number(monitorId)))
        .get();

      const monitor = selectMonitorSchema.parse(currentMonitor);

      const numberOfRegions = monitor.regions.length;

      console.log(
        `🤓 MonitorID ${monitorId} incident current affected ${nbAffectedRegion} total region ${numberOfRegions}`,
      );
      // If the number of affected regions is greater than half of the total region, we  trigger the alerting
      // 4 of 6 monitor need to fail to trigger an alerting
      if (nbAffectedRegion >= numberOfRegions / 2 || numberOfRegions === 1) {
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
          const newIncident = await db
            .insert(incidentTable)
            .values({
              monitorId: Number(monitorId),
              workspaceId: monitor.workspaceId,
              startedAt: new Date(cronTimestamp),
            })
            .onConflictDoNothing()
            .returning();

          await triggerNotifications({
            monitorId,
            statusCode,
            message,
            notifType: "alert",
            cronTimestamp,
            incidentId: newIncident.length
              ? String(newIncident[0]?.id)
              : `${cronTimestamp}`,
          });

          if (newIncident.length > 0) {
            const monitor = await db
              .select({
                url: schema.monitor.url,
                jobType: schema.monitor.jobType,
                workspaceId: schema.monitor.workspaceId,
              })
              .from(schema.monitor)
              .where(eq(schema.monitor.id, Number(monitorId)))
              .get();
            if (monitor && monitor.jobType === "http" && monitor.workspaceId) {
              const currentWorkspace = await db
                .select()
                .from(workspace)
                .where(eq(workspace.id, monitor.workspaceId))
                .get();
              if (
                !!currentWorkspace?.plan &&
                currentWorkspace?.plan !== "free"
              ) {
                await triggerScreenshot({
                  data: {
                    url: monitor.url,
                    incidentId: newIncident[0].id,
                    kind: "incident",
                  },
                });
              }
            }
          }
        }
      }
    }
  }
  // When the status is ok
  if (status === "active") {
    await upsertMonitorStatus({
      monitorId: monitorId,
      status: "active",
      region: region,
    });

    await checkerAudit.publishAuditLog({
      id: `monitor:${monitorId}`,
      action: "monitor.recovered",
      targets: [{ id: monitorId, type: "monitor" }],
      metadata: { region: region, statusCode: statusCode ?? -1 },
    });

    if (incident) {
      const redisKey = `${monitorId}-${incident.id}-resolved`;
      //   // We add the new region to the set
      await redis.sadd(redisKey, region);
      //   // let's add an expire to the set
      //   // We get the number of regions affected
      const nbAffectedRegion = await redis.scard(redisKey);
      await redis.expire(redisKey, 60 * 60 * 24);

      const currentMonitor = await db
        .select()
        .from(schema.monitor)
        .where(eq(schema.monitor.id, Number(monitorId)))
        .get();

      const monitor = selectMonitorSchema.parse(currentMonitor);

      const numberOfRegions = monitor.regions.length;

      console.log(
        `🤓 MonitorId ${monitorId} recovering incident current ${nbAffectedRegion} total region ${numberOfRegions}`,
      );
      //   // If the number of affected regions is greater than half of the total region, we  trigger the alerting
      //   // 4 of 6 monitor need to fail to trigger an alerting
      if (nbAffectedRegion >= numberOfRegions / 2 || numberOfRegions === 1) {
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
        if (incident) {
          console.log(`🤓 recovering incident ${incident.id}`);
          await db
            .update(incidentTable)
            .set({
              resolvedAt: new Date(cronTimestamp),
              autoResolved: true,
            })
            .where(eq(incidentTable.id, incident.id))
            .run();

          await triggerNotifications({
            monitorId,
            statusCode,
            message,
            notifType: "recovery",
            cronTimestamp,
            incidentId: String(incident.id),
          });

          const monitor = await db
            .select({
              url: schema.monitor.url,
              jobType: schema.monitor.jobType,
              workspaceId: schema.monitor.workspaceId,
            })
            .from(schema.monitor)
            .where(eq(schema.monitor.id, Number(monitorId)))
            .get();
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
                  incidentId: incident.id,
                  kind: "recovery",
                },
              });
            }
          }
        }
      }
    }
  }

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

  const client = new Client({ token: env.QSTASH_TOKEN });

  await client.publishJSON({
    url: env.SCREENSHOT_SERVICE_URL,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": `Basic ${env.CRON_SECRET}`,
    },
    body: {
      url: data.url,
      incidentId: data.incidentId,
      kind: data.kind,
    },
  });
};
