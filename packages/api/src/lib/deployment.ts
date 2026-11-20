import { z } from "zod";

import { env } from "../env";

const DEFAULT_STATUS_PAGE_BASE_DOMAIN = "openstatus.dev";

// `env` skips validation under NODE_ENV=test and then hands back the raw
// strings, so coerce here instead of trusting the schema's boolean.
export function isSelfHost(): boolean {
  const value: unknown = env.SELF_HOST;
  if (typeof value === "boolean") return value;
  return z.stringbool().catch(false).parse(value);
}

/** Domain under which a page without a custom domain lives: `{slug}.{base}`. */
export function getStatusPageBaseDomain(): string {
  const value: unknown = env.STATUS_PAGE_BASE_DOMAIN;
  const normalized = (typeof value === "string" ? value : "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^\.+|\.+$/g, "");
  return normalized || DEFAULT_STATUS_PAGE_BASE_DOMAIN;
}
