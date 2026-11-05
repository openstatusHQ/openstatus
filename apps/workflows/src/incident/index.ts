import { db, schema } from "@openstatus/db";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { Hono } from "hono";

import { env } from "../env";

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
    .select({ monitorId: schema.monitorIncidentTable.monitorId })
    .from(schema.monitorIncidentTable)
    .where(isNull(schema.monitorIncidentTable.resolvedAt));

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
    .update(schema.monitorIncidentTable)
    .set({
      resolvedAt: new Date(),
      autoResolved: true,
    })
    .where(
      and(
        inArray(schema.monitorIncidentTable.monitorId, monitorIds),
        isNull(schema.monitorIncidentTable.resolvedAt),
      ),
    )
    .returning({ id: schema.monitorIncidentTable.id });

  return c.json({ status: "ok", updated: result.length });
});
