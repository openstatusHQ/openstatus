const REDACTED = "[redacted]";

/** Segments whose *next* segment is a subscriber token, not a public path part. */
const TOKEN_ROUTES = new Set(["manage", "unsubscribe", "verify"]);

const SECRET_PARAMS = new Set(["pw", "password", "token", "redirect"]);

/**
 * Masks the subscriber token in `/{slug}/{locale}/manage/{token}` and its
 * sibling routes. The proxy logs every request path, and a leaked token is
 * enough to read and change someone's subscription.
 */
export function redactLogPathname(pathname: string): string {
  const segments = pathname.split("/");
  return segments
    .map((segment, index) =>
      segment && TOKEN_ROUTES.has(segments[index - 1]?.toLowerCase() ?? "")
        ? REDACTED
        : segment,
    )
    .join("/");
}

/**
 * Log-safe form of an action URL: token segments masked, and the values of
 * params that carry secrets (`?pw=` is the page password) replaced.
 */
export function redactLogUrl(url: URL | undefined): string | null {
  if (!url) return null;

  const redacted = new URL(url);
  redacted.pathname = redactLogPathname(redacted.pathname);

  const params = new URLSearchParams();
  for (const [key, value] of redacted.searchParams) {
    params.append(key, SECRET_PARAMS.has(key.toLowerCase()) ? REDACTED : value);
  }
  redacted.search = params.toString();

  return redacted.toString();
}
