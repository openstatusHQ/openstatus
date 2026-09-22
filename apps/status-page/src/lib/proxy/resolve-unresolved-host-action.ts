import { isThemeExplorerHost } from "../theme-explorer-host";
import { type Action, passthrough } from "./types";

/** Matches no route, so Next renders the app's own 404. */
export const NOT_FOUND_PATH = "/_not-found";

/**
 * Decides what to serve when a request resolves to no page — an unknown slug,
 * or a custom domain pointed at the deployment but missing from the `page`
 * table. Passing those through would serve `/`, which is the theme explorer, so
 * the host would answer with the explorer and its OG image instead of a 404.
 */
export function resolveUnresolvedHostAction({
  host,
  urlHost,
  requestUrl,
}: {
  /** x-forwarded-host header value */
  host: string | null;
  /** req.nextUrl.host */
  urlHost: string;
  requestUrl: string;
}): Action {
  if (isThemeExplorerHost(host ?? urlHost)) {
    return passthrough("theme-explorer-host");
  }
  return {
    type: "rewrite",
    url: new URL(NOT_FOUND_PATH, requestUrl),
    reason: "unresolved-host",
  };
}
