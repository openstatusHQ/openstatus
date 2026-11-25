/**
 * Client IP for access-gate checks. Prefer `x-real-ip`: Vercel's edge sets it to
 * the single verified client IP, with no comma-chain to parse. `x-forwarded-for`'s
 * leftmost entry is the classic spoof vector on paths that reach a route directly
 * — `/api/*` bypasses the proxy middleware — so only fall back to it when
 * `x-real-ip` is absent (e.g. local dev). A null result denies ip-restricted pages.
 */
export function resolveClientIp(headers: {
  get(name: string): string | null;
}): string | null {
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() ?? null;
}
