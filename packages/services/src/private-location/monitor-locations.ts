import { and, db as defaultDb, eq, inArray, isNull } from "@openstatus/db";
import type { MonitorStatus } from "@openstatus/db/src/schema";
import {
  privateLocation,
  privateLocationMonitorStatus,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";

// No workspace filter: the private-location ingest holds only the ids it was sent.

/** The location's name when it is attached to the monitor, else undefined. */
export async function findPrivateLocationAttachment(args: {
  monitorId: number;
  privateLocationId: number;
  db?: DB;
}): Promise<{ name: string } | undefined> {
  return (args.db ?? defaultDb)
    .select({ name: privateLocation.name })
    .from(privateLocationToMonitors)
    .innerJoin(
      privateLocation,
      eq(privateLocation.id, privateLocationToMonitors.privateLocationId),
    )
    .where(
      and(
        eq(privateLocationToMonitors.monitorId, args.monitorId),
        eq(privateLocationToMonitors.privateLocationId, args.privateLocationId),
        isNull(privateLocationToMonitors.deletedAt),
      ),
    )
    .get();
}

/**
 * How many private locations the monitor is attached to, and how many of them
 * last reported `status`.
 */
export async function countPrivateLocationsReporting(args: {
  monitorId: number;
  status: MonitorStatus;
  db?: DB;
}): Promise<{ locationCount: number; affectedCount: number }> {
  const { monitorId, status } = args;
  const db = args.db ?? defaultDb;

  const locations = await db
    .select({ id: privateLocationToMonitors.privateLocationId })
    .from(privateLocationToMonitors)
    .where(
      and(
        eq(privateLocationToMonitors.monitorId, monitorId),
        isNull(privateLocationToMonitors.deletedAt),
      ),
    )
    .all();

  const locationIds = locations
    .map((loc) => loc.id)
    .filter((id): id is number => id !== null);

  const reporting = await db
    .select({
      privateLocationId: privateLocationMonitorStatus.privateLocationId,
    })
    .from(privateLocationMonitorStatus)
    .where(
      and(
        eq(privateLocationMonitorStatus.monitorId, monitorId),
        eq(privateLocationMonitorStatus.status, status),
        inArray(privateLocationMonitorStatus.privateLocationId, locationIds),
      ),
    )
    .all();

  return { locationCount: locations.length, affectedCount: reporting.length };
}
