import type { Page } from "@openstatus/db/src/schema";
import { buildExternalPath } from "./build-external-path";
import { isIpAllowed } from "./is-ip-allowed";
import type { Action, ComposeInput } from "./types";

type Input = Pick<
  ComposeInput,
  "route" | "pathname" | "clientIp" | "origin"
> & {
  page: Pick<Page, "accessType" | "allowedIpRanges">;
};

/**
 * IP-restriction access control. Handles both gate-in (disallowed IP →
 * /restricted) and gate-out (allowed IP on /restricted → page root).
 *
 * Note on `endsWith("/restricted")`: deliberately loose; preserved from the
 * original middleware.
 */
export function resolveIpRestrictionAction({
  route,
  page,
  pathname,
  clientIp,
  origin,
}: Input): Action | null {
  if (page.accessType !== "ip-restriction") return null;

  const allowed = !!(clientIp && isIpAllowed(clientIp, page.allowedIpRanges));
  const isOnRestricted = pathname.endsWith("/restricted");

  // Gate-in: disallowed and not already on /restricted → send to /restricted
  if (!isOnRestricted && !allowed) {
    return {
      type: "redirect",
      url: new URL(`${origin}${buildExternalPath(route, "/restricted")}`),
      reason: "ip-restriction-gate-in",
    };
  }

  // Gate-out: allowed and on /restricted → send to page root
  if (isOnRestricted && allowed) {
    return {
      type: "redirect",
      url: new URL(`${origin}${buildExternalPath(route, "")}`),
      reason: "ip-restriction-gate-out",
    };
  }

  return null;
}
