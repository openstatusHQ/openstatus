import type { Limits } from "@openstatus/db/src/schema/plan/schema";

import { planFeatureNotAvailableError } from "../../errors";

/**
 * `private-locations` is a boolean entitlement, not a row-count cap — there is
 * no per-workspace limit on how many agents a paid plan may register.
 */
export function checkPrivateLocationsEnabled(limits: Limits): void {
  if (!limits["private-locations"]) {
    throw planFeatureNotAvailableError(
      "Upgrade to use private locations",
      "private-locations",
    );
  }
}
