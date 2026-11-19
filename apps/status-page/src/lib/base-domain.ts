/** Hosted openstatus serves `{slug}.openstatus.dev`. */
export const DEFAULT_STATUS_PAGE_BASE_DOMAIN = "openstatus.dev";

/**
 * Normalizes a configured base domain to a bare lowercase hostname: drops a
 * scheme, path, port and surrounding dots. An empty value means the default.
 */
export function normalizeBaseDomain(value?: string | null): string {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^\.+|\.+$/g, "");
  return normalized || DEFAULT_STATUS_PAGE_BASE_DOMAIN;
}

/**
 * Domain under which a page is reachable as `{slug}.{base}`. Read at request
 * time from `STATUS_PAGE_BASE_DOMAIN` (server only) so prebuilt images can be
 * configured at runtime. On the client this always yields the default — client
 * components get the server value passed down instead.
 */
export function getStatusPageBaseDomain(): string {
  return normalizeBaseDomain(process.env.STATUS_PAGE_BASE_DOMAIN);
}

/** True when `host` (port ignored) is the base domain or one of its subdomains. */
export function isHostUnderBaseDomain(
  host: string | null | undefined,
  baseDomain: string,
): boolean {
  if (!host) return false;
  // Case-sensitive on purpose: an uppercase Host keeps being read as a custom
  // domain, as for openstatus.dev (see the "known gaps" test in domain.test.ts).
  const bare = host.replace(/:\d+$/, "");
  const base = normalizeBaseDomain(baseDomain);
  return bare === base || bare.endsWith(`.${base}`);
}
