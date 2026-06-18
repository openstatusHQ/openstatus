import type { Page } from "@openstatus/db/src/schema";

import { isIpAllowed } from "./is-ip-allowed";

export type MarkdownGateResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; body: string };

/**
 * Pure access-control decision for a markdown request, mirroring the proxy gate
 * chain. Security-critical: the markdown route is reachable directly via `/api`,
 * which bypasses the proxy, so this is the only enforcement on that path.
 */
export function evaluateMarkdownGate(input: {
  accessType: Page["accessType"];
  password: string | null;
  queryPassword: string | null;
  cookiePassword: string | undefined;
  authEmail: string | null | undefined;
  authEmailDomains: string[] | null;
  clientIp: string | null | undefined;
  allowedIpRanges: string[] | null;
}): MarkdownGateResult {
  switch (input.accessType) {
    case "public":
      return { ok: true };

    case "password": {
      const expected = input.password;
      // Empty/absent stored password should never authorize an empty input.
      if (!expected) {
        return { ok: false, status: 401, body: "Unauthorized" };
      }
      if (
        input.queryPassword === expected ||
        input.cookiePassword === expected
      ) {
        return { ok: true };
      }
      return { ok: false, status: 401, body: "Unauthorized" };
    }

    case "email-domain": {
      const domain = input.authEmail?.split("@")[1];
      const allowed = input.authEmailDomains ?? [];
      if (domain && allowed.includes(domain)) {
        return { ok: true };
      }
      return { ok: false, status: 403, body: "Forbidden" };
    }

    case "ip-restriction": {
      const ip = input.clientIp;
      const ranges = input.allowedIpRanges ?? [];
      if (ip && isIpAllowed(ip, ranges)) {
        return { ok: true };
      }
      return { ok: false, status: 403, body: "Forbidden" };
    }

    default:
      // Unknown access type → deny.
      return { ok: false, status: 403, body: "Forbidden" };
  }
}
