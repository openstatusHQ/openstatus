import { Code, ConnectError } from "@connectrpc/connect";
import { and, db, eq, isNull, sql } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import { monitorRegionSchema } from "@openstatus/db/src/schema/constants";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import type { Periodicity, Region } from "@openstatus/proto/monitor/v1";
import { z } from "zod";

import { periodicityToString, regionsToStrings } from "./converters";

/**
 * Check the plan limits that apply to a monitor's configuration. Safe on both
 * create and update — it never looks at how many monitors already exist.
 * Throws ConnectError with PermissionDenied if any limit is exceeded.
 */
export function checkMonitorConfigLimits(
  limits: Limits,
  periodicity: Periodicity | undefined,
  regions: Region[] | undefined,
): void {
  // Check periodicity limit
  if (periodicity) {
    const periodicityStr = periodicityToString(periodicity);
    if (!limits.periodicity.includes(periodicityStr)) {
      throw new ConnectError(
        "Upgrade for more periodicity options",
        Code.PermissionDenied,
      );
    }
  }

  // Check regions limits
  if (regions && regions.length > 0) {
    const regionStrings = z
      .array(monitorRegionSchema)
      .parse(regionsToStrings(regions));

    // Check max regions limit
    if (regionStrings.length > limits["max-regions"]) {
      throw new ConnectError("Upgrade for more regions", Code.PermissionDenied);
    }

    // Check if each region is allowed
    for (const region of regionStrings) {
      if (!limits.regions.includes(region)) {
        throw new ConnectError(
          `Region '${region}' is not available on your plan. Upgrade for more regions`,
          Code.PermissionDenied,
        );
      }
    }
  }
}

/**
 * Check workspace limits for creating a new monitor.
 * Throws ConnectError with PermissionDenied if any limit is exceeded.
 *
 * Create-only: the row-count cap must not run on update, or a workspace
 * sitting at its limit could no longer edit the monitors it already has.
 */
export async function checkMonitorLimits(
  workspaceId: number,
  limits: Limits,
  periodicity: Periodicity | undefined,
  regions: Region[] | undefined,
): Promise<void> {
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(monitor)
    .where(and(eq(monitor.workspaceId, workspaceId), isNull(monitor.deletedAt)))
    .get();

  const count = countResult?.count ?? 0;
  if (count >= limits.monitors) {
    throw new ConnectError("Upgrade for more monitors", Code.PermissionDenied);
  }

  checkMonitorConfigLimits(limits, periodicity, regions);
}
