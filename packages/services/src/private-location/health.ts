import { and, db as defaultDb, eq, isNotNull, isNull } from "@openstatus/db";
import {
  monitor,
  privateLocation,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type DB, type ServiceContext, getReadDb } from "../context";

/** Every private location, across workspaces, whose agent has reported at least once. */
export async function listReportingPrivateLocations(args: { db?: DB } = {}) {
  const db = args.db ?? defaultDb;
  return db
    .select({
      id: privateLocation.id,
      name: privateLocation.name,
      status: privateLocation.status,
      lastSeenAt: privateLocation.lastSeenAt,
      workspaceId: privateLocation.workspaceId,
    })
    .from(privateLocation)
    .where(isNotNull(privateLocation.lastSeenAt))
    .all();
}

/** Active, non-deleted monitors scheduled on the private location. */
export async function countScheduledMonitors(args: {
  ctx: ServiceContext;
  privateLocationId: number;
}): Promise<number> {
  requireScope(args.ctx, "monitors:read");
  const rows = await getReadDb(args.ctx)
    .select({ id: monitor.id })
    .from(privateLocationToMonitors)
    .innerJoin(monitor, eq(privateLocationToMonitors.monitorId, monitor.id))
    .where(
      and(
        eq(privateLocationToMonitors.privateLocationId, args.privateLocationId),
        isNull(privateLocationToMonitors.deletedAt),
        eq(monitor.workspaceId, args.ctx.workspace.id),
        eq(monitor.active, true),
        isNull(monitor.deletedAt),
      ),
    )
    .all();
  return rows.length;
}
