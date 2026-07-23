/**
 * Cache-Control for a markdown response. Only PUBLIC pages served via the `.md`
 * suffix are edge-cacheable; gated pages (password/email-domain/ip-restriction)
 * must always be `private, no-store` — a `.md` suffix is not a license to cache
 * authorized content where the CDN could serve it to an unauthorized request.
 */
export function markdownCacheControl(
  source: string | null,
  accessType: string | null | undefined,
): string {
  return source === "suffix" && accessType === "public"
    ? "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
    : "private, no-store";
}
