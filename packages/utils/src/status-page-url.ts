export interface GetStatusPageBaseUrlOptions {
  slug?: string;
  customDomain?: string | null;
  /**
   * Explicit override URL. When omitted, falls back to
   * `process.env.STATUS_PAGE_BASE_URL` or `process.env.OPENSTATUS_STATUS_PAGE_URL`.
   */
  override?: string;
  /**
   * Explicit Node environment. When omitted, falls back to `process.env.NODE_ENV`.
   */
  nodeEnv?: string;
}

/**
 * Resolves the public status page base URL for email links, feeds, and status page navigation.
 *
 * Precedence:
 * 1. Administrator override (via options.override, `STATUS_PAGE_BASE_URL`, or `OPENSTATUS_STATUS_PAGE_URL`).
 *    Supports `{slug}` templating (e.g. `https://{slug}.example.com` or `https://status.example.com/{slug}`)
 *    and preserves explicit ports (e.g. `https://status.example.net:8443`).
 * 2. Localhost in development (`http://localhost:3000/${slug}`).
 * 3. Verified custom domain (`https://${customDomain}`).
 * 4. Hosted Cloud fallback (`https://${slug}.openstatus.dev`).
 */
export function getStatusPageBaseUrl(
  options?: GetStatusPageBaseUrlOptions,
): string {
  const slug = options?.slug;
  const customDomain = options?.customDomain;
  const rawOverride =
    options?.override ??
    (typeof process !== "undefined"
      ? process.env.STATUS_PAGE_BASE_URL ||
        process.env.OPENSTATUS_STATUS_PAGE_URL
      : undefined);

  if (rawOverride && rawOverride.trim().length > 0) {
    let end = rawOverride.trim().length;
    const trimmedRaw = rawOverride.trim();
    while (end > 0 && trimmedRaw[end - 1] === "/") end--;
    const trimmed = trimmedRaw.slice(0, end);

    if (trimmed.includes("{slug}")) {
      return slug ? trimmed.replaceAll("{slug}", slug) : trimmed;
    }
    return trimmed;
  }

  const nodeEnv =
    options?.nodeEnv ??
    (typeof process !== "undefined" ? process.env.NODE_ENV : undefined);

  if (nodeEnv === "development") {
    return slug ? `http://localhost:3000/${slug}` : "http://localhost:3000";
  }

  if (customDomain) {
    return customDomain.startsWith("http://") ||
      customDomain.startsWith("https://")
      ? customDomain
      : `https://${customDomain}`;
  }

  return slug ? `https://${slug}.openstatus.dev` : "https://openstatus.dev";
}
