import {
  THEME_EXPLORER_PAGE_SLUG,
  isCanonicalThemeExplorerHost,
} from "./theme-explorer-host";

/**
 * Computes the prefix used for client-side navigation links.
 *
 * - Hostname routing (subdomain / custom domain): locale only (empty for default)
 * - Pathname routing: always `{slug}/{locale}`
 * - The theme explorer host is subdomain-shaped but owns no page, so its own
 *   demo page at `/status/{locale}` is pathname routed
 */
export function resolvePathnamePrefix({
  hostname,
  pathname,
  customDomain,
  locale,
  defaultLocale,
}: {
  hostname: string;
  pathname: string;
  customDomain: string | undefined;
  locale: string;
  defaultLocale: string;
}): string {
  const hostnames = hostname.split(".");
  const isCustomDomain = customDomain ? hostname === customDomain : false;

  // acme.localhost:3000 → ["acme", "localhost:3000"] (length 2, but is a subdomain)
  // acme.stpg.dev → ["acme", "stpg", "dev"] (length 3+)
  // localhost:3000 → ["localhost:3000"] (length 1, pathname routing)
  const hasLocalhostSubdomain =
    hostnames.length === 2 && /^localhost(:\d+)?$/.test(hostnames[1]);
  const isSubdomain =
    (hostnames.length > 2 || hasLocalhostSubdomain) &&
    hostnames[0] !== "www" &&
    !hostname.endsWith(".vercel.app");

  const firstSegment = pathname.split("/")[1] || "";

  // The theme explorer host is subdomain-shaped but owns no page of its own —
  // its demo page is served from `/status/{locale}`, so links there keep the
  // slug prefix instead of dropping it like a real subdomain page would. Only
  // the canonical host serves that page, so it alone opts in.
  const isThemeExplorerPage =
    isCanonicalThemeExplorerHost(hostname) &&
    firstSegment.toLowerCase() === THEME_EXPLORER_PAGE_SLUG;

  if (!isThemeExplorerPage && (isCustomDomain || isSubdomain)) {
    // Subdomain or custom domain — no slug prefix needed
    return locale !== defaultLocale ? locale : "";
  }

  // Pathname routing — always {slug}/{locale}
  return `${firstSegment}/${locale}`;
}
