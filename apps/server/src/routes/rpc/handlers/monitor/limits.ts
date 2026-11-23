import { Code, ConnectError } from "@connectrpc/connect";
import { monitorRegionSchema } from "@openstatus/db/src/schema/constants";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import type { Periodicity, Region } from "@openstatus/proto/monitor/v1";
import { uniqueRegions } from "@openstatus/utils";
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
      .parse(uniqueRegions(regionsToStrings(regions)));

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
