import { wwwCounterpart } from "@openstatus/utils";

import type { ResolvedRoute } from "../resolve-route";

/** For a custom-domain host no page holds, the `www.`/apex alias a page may hold instead. */
export function counterpartHost(route: ResolvedRoute): string | null {
  if (route.type !== "hostname" || !route.prefix.includes(".")) return null;
  return wwwCounterpart(route.prefix);
}

/**
 * The same request on the page's own domain. Drops a leading segment repeating
 * the alias host (the apps/web `/:domain/:path*` proxy) and assigns the path
 * instead of resolving it, so `//evil.com` cannot become the target host.
 */
export function canonicalDomainUrl(args: {
  route: Pick<ResolvedRoute, "prefix">;
  customDomain: string;
  pathname: string;
  search: string;
}): URL {
  const segments = args.pathname.split("/").filter(Boolean);
  if (segments[0]?.toLowerCase() === args.route.prefix) segments.shift();
  const url = new URL(`https://${args.customDomain}`);
  url.pathname = `/${segments.join("/")}`;
  url.search = args.search;
  return url;
}
