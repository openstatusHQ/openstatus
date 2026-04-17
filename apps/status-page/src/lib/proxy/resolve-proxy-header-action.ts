import type { ResolvedRoute } from "../resolve-route";
import type { Action } from "./types";

interface Input {
  route: ResolvedRoute;
  pathname: string;
  /** Search string from the incoming URL, including leading "?" (or empty). Preserved on the rewrite. */
  search: string;
  /** Value of the `x-proxy` header. Null/empty means this stage declines. */
  proxyHeader: string | null | undefined;
  /** Base URL for constructing the rewrite target (typically req.url). */
  requestUrl: string;
}

/**
 * When the request carries an `x-proxy` header, rewrite to the page-prefixed
 * path (`/{prefix}{pathname}`) while preserving search params. Used by an
 * upstream proxy layer to short-circuit custom-domain resolution.
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
