/**
 * Validates a `?redirect=...` query value for use as a safe path suffix when
 * concatenated with an origin. Returns the value unchanged if it's a normal
 * absolute path, or null otherwise. Applied at the proxy input boundary so
 * every downstream resolver can trust the value.
 *
 * Rejects:
 *  - missing/empty values
 *  - values that don't start with `/` (e.g. `http://evil.com` — concatenating
 *    these with an origin produces strings that throw in `new URL(...)` and
 *    500 the request)
 *  - protocol-relative paths (`//…` or `/\…`, which URL parsers normalise to
 *    a scheme-less authority and can escape the host)
 *  - whitespace / control characters (which cause `new URL(...)` to throw or
 *    get silently mangled across parsers)
 */
export function sanitizeRedirectParam(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\s\x00-\x1f]/.test(value)) return null;
  return value;
}
