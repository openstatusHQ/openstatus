import { wwwCounterpart } from "@openstatus/utils";

import type { ResolvedRoute } from "../resolve-route";

/** For a custom-domain host no page holds, the `www.`/apex alias a page may hold instead. */
export function counterpartHost(route: ResolvedRoute): string | null {
  if (route.type !== "hostname" || !route.prefix.includes(".")) return null;
  return wwwCounterpart(route.prefix);
}

export function canonicalDomainUrl(args: {
  customDomain: string;
  pathname: string;
  search: string;
}): URL {
  return new URL(
    `${args.pathname}${args.search}`,
    `https://${args.customDomain}`,
  );
}
