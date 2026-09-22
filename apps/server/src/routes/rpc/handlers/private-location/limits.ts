import { Code, ConnectError } from "@connectrpc/connect";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";

/**
 * `private-locations` is a boolean entitlement, not a row-count cap — there is
 * no per-workspace limit on how many agents a paid plan may register.
 */
export function checkPrivateLocationsEnabled(limits: Limits): void {
  if (!limits["private-locations"]) {
    throw new ConnectError(
      "Upgrade to use private locations",
      Code.PermissionDenied,
    );
  }
}
