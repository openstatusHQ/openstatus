import { and, eq, isNull } from "@openstatus/db";
import {
  monitor,
  privateLocation,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";
import { assertSafeUrlSync } from "@openstatus/utils";

import type { DB } from "../context";
import { ValidationError } from "../errors";

async function hasPrivateLocation(args: {
  tx: DB;
  workspaceId: number;
  monitorId: number;
}): Promise<boolean> {
  const { tx, workspaceId, monitorId } = args;
  const row = await tx
    .select({ id: privateLocationToMonitors.privateLocationId })
    .from(privateLocationToMonitors)
    .innerJoin(
      privateLocation,
      eq(privateLocationToMonitors.privateLocationId, privateLocation.id),
    )
    .innerJoin(monitor, eq(privateLocationToMonitors.monitorId, monitor.id))
    .where(
      and(
        eq(privateLocationToMonitors.monitorId, monitorId),
        eq(privateLocation.workspaceId, workspaceId),
        eq(monitor.workspaceId, workspaceId),
        isNull(privateLocationToMonitors.deletedAt),
        isNull(monitor.deletedAt),
      ),
    )
    .get();
  return row !== undefined;
}

/**
 * Reject monitor URLs pointing at private/internal infrastructure.
 *
 * Only `http` is checked: TCP takes `host:port` and DNS a bare hostname,
 * neither of which parses as a URL, and TCP documents private targets as a
 * supported input. Monitors attached to a private location are exempt — those
 * probes run inside the customer's own network, where an internal target is
 * the whole point.
 */
export async function assertMonitorUrlSafe(args: {
  tx: DB;
  workspaceId: number;
  jobType: string;
  url: string;
  monitorId?: number;
}): Promise<void> {
  const { tx, workspaceId, jobType, url, monitorId } = args;
  if (jobType !== "http") return;

  if (
    monitorId !== undefined &&
    (await hasPrivateLocation({ tx, workspaceId, monitorId }))
  ) {
    return;
  }

  try {
    assertSafeUrlSync(url);
  } catch (err) {
    throw new ValidationError(
      err instanceof Error ? err.message : "Invalid URL",
      err,
    );
  }
}
