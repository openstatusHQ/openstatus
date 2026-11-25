import type { Page } from "@openstatus/db/src/schema";

import { isEmailDomainAuthorized, isIpAuthorized } from "./access-predicates";

export type MarkdownGateResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; body: string };

/**
 * Pure access-control decision for a markdown request, mirroring the proxy gate
 * chain. Security-critical: the markdown route is reachable directly via `/api`,
 * which bypasses the proxy, so this is the only enforcement on that path.
 *
 * `passwordAuthorized` is resolved server-side (via `statusPage.isPasswordAuthorized`)
 * so the stored password never reaches this surface.
 */
export function evaluateMarkdownGate(input: {
  accessType: Page["accessType"];
  passwordAuthorized: boolean;
  authEmail: string | null | undefined;
  authEmailDomains: string[] | null;
  clientIp: string | null | undefined;
  allowedIpRanges: string[] | null;
}): MarkdownGateResult {
  switch (input.accessType) {
    case "public":
      return { ok: true };

    case "password":
      return input.passwordAuthorized
        ? { ok: true }
        : { ok: false, status: 401, body: "Unauthorized" };

    case "email-domain":
      return isEmailDomainAuthorized(input.authEmail, input.authEmailDomains)
        ? { ok: true }
        : { ok: false, status: 403, body: "Forbidden" };

    case "ip-restriction":
      return isIpAuthorized(input.clientIp, input.allowedIpRanges)
        ? { ok: true }
        : { ok: false, status: 403, body: "Forbidden" };

    default:
      // Unknown access type → deny.
      return { ok: false, status: 403, body: "Forbidden" };
  }
}
