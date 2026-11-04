/**
 * Cache-Control for the status badges. The status comes from the public
 * `/public/status/:slug` API, so the badge is the same for every viewer and
 * safe to cache at the edge — a short TTL keeps embeds fresh while sparing a
 * function invocation per view.
 */
export const BADGE_CACHE_CONTROL =
  "public, max-age=60, s-maxage=60, stale-while-revalidate=300";
