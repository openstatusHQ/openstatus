/**
 * Computes the prefix used for client-side navigation links.
 *
 * - Hostname routing (subdomain / custom domain): locale only (empty for default)
 * - Pathname routing: always `{slug}/{locale}`
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

  if (isCustomDomain || isSubdomain) {
    // Subdomain or custom domain — no slug prefix needed
    return locale !== defaultLocale ? locale : "";
  }

  // Pathname routing — always {slug}/{locale}
  const slug = pathname.split("/")[1] || "";
  return `${slug}/${locale}`;
}
