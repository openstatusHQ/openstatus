import { schema } from "@openstatus/db";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { Hono } from "hono";
import { env } from "../env";
import { db } from "../lib/db";

export const incidentRoute = new Hono({ strict: false });

incidentRoute.use("*", async (c, next) => {
  if (c.req.header("authorization") !== env().CRON_SECRET) {
    return c.text("Unauthorized", 401);
  }

  return next();
});

incidentRoute.get("/cleanup", async (c) => {
  // Find monitors that have unresolved incidents but are active
  const unresolvedIncidentMonitorIds = db
    .select({ monitorId: schema.incidentTable.monitorId })
    .from(schema.incidentTable)
    .where(isNull(schema.incidentTable.resolvedAt));

  const activeMonitorsWithUnresolvedIncidents = await db
    .select({ id: schema.monitor.id })
    .from(schema.monitor)
    .where(
      and(
        inArray(schema.monitor.id, unresolvedIncidentMonitorIds),
        eq(schema.monitor.active, true),
        ne(schema.monitor.status, "error"),
      ),
    )
    .all();

  const monitorIds = activeMonitorsWithUnresolvedIncidents.map((m) => m.id);

  if (monitorIds.length === 0) {
    return c.json({ status: "ok", updated: 0 });
  }

  // Update incidents for these monitors: set resolvedAt to now and autoResolved to true
  const result = await db
    .update(schema.incidentTable)
    .set({
      resolvedAt: new Date(),
      autoResolved: true,
    })
    .where(
      and(
        inArray(schema.incidentTable.monitorId, monitorIds),
        isNull(schema.incidentTable.resolvedAt),
      ),
    )
    .returning({ id: schema.incidentTable.id });

  return c.json({ status: "ok", updated: result.length });
});
