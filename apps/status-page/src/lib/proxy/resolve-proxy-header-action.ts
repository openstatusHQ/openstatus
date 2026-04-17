import type { Action, ComposeInput } from "./types";

type Input = Pick<
  ComposeInput,
  "route" | "pathname" | "search" | "proxyHeader" | "requestUrl"
>;

/**
 * When the request carries an `x-proxy` header, rewrite to the page-prefixed
 * path (`/{prefix}{pathname}`) while preserving search params. Used by an
 * upstream proxy layer to short-circuit custom-domain resolution.
 *
 * SECURITY: This header carries no secret. Any client that can set it bypasses
 * custom-domain resolution and can reach arbitrary `/{prefix}{pathname}` paths
 * — i.e. any page's internal route via its slug. This is only safe if the
 * header is guaranteed to be stripped/controlled by a trusted edge or ingress
 * layer before it reaches the Next.js middleware. If that assumption ever
 * breaks (or we move hosts), gate this stage behind an HMAC-signed header or
 * remove it.
 */
export function resolveProxyHeaderAction({
  route,
  pathname,
  search,
  proxyHeader,
  requestUrl,
}: Input): Action | null {
  if (!proxyHeader) return null;

  const url = new URL(`/${route.prefix}${pathname}`, requestUrl);
  url.search = search;
  return {
    type: "rewrite",
    url,
    reason: "proxy-header-rewrite",
  };
}
