import type { ResolvedRoute } from "../resolve-route";
import type { Action } from "./types";

interface Input {
  route: ResolvedRoute;
  host: string | null;
  pathname: string;
  /** Incoming search string, preserved on the rewrite. */
  search: string;
  /** Base URL for constructing the rewrite target (typically req.url). */
  requestUrl: string;
}

/**
 * Fallback rewrite: target is the route's internal `rewritePath`. Fires when
 * either:
 *   - the request is on an openstatus.dev host (preserved from original —
 *     unclear if this no-op rewrite is load-bearing when rewritePath ===
 *     pathname; kept as-is), OR
 *   - the resolved rewritePath differs from the incoming pathname.
 */
export function resolveDefaultRewrite({
  route,
  host,
  pathname,
  search,
  requestUrl,
}: Input): Action | null {
  const isOpenstatusDevHost = !!host?.includes("openstatus.dev");
  const pathDiffers = route.rewritePath !== pathname;

  if (!isOpenstatusDevHost && !pathDiffers) return null;

  const url = new URL(route.rewritePath, requestUrl);
  url.search = search;
  return {
    type: "rewrite",
    url,
    reason: "default-rewrite",
  };
}
