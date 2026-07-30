import { resolveRoute } from "./resolve-route";

/**
 * Slug of the status page the proxy resolved for the request. Anything running
 * behind the proxy must read this instead of re-deriving the page from the
 * host: under pathname routing (`/{slug}/…`, used on preview deployments) the
 * host carries no slug at all.
 */
export const PAGE_SLUG_HEADER = "x-status-page-slug";

export function getPageSlugHeader(headers: Headers): string | null {
  return headers.get(PAGE_SLUG_HEADER)?.toLowerCase() || null;
}

/**
 * Base URL of a page. Only the origin when the host identifies the page;
 * pathname-routed deployments (previews, bare localhost) need the slug too.
 */
export function buildPageBaseUrl({
  origin,
  slug,
}: {
  origin: string;
  slug: string;
}): string {
  const hostnameRouted = resolveRoute({
    host: null,
    urlHost: parseUrl(origin)?.host ?? "",
    pathname: "/",
  });
  return hostnameRouted ? origin : `${origin}/${slug}`;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
