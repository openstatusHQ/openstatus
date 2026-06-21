import { isIpAllowed } from "./is-ip-allowed";

/**
 * Pure allow/deny predicates shared by the proxy gate chain (which wraps them in
 * redirects) and the markdown route gate (which wraps them in status codes).
 * Keeping the authorization core here is the guarantee that the two surfaces
 * cannot drift — only their wrapping behaviour differs.
 */

// Length-independent comparison so a wrong guess can't be timed by length or
// character. Pure JS (no node:crypto): must be Edge-safe for the proxy, so it
// can't import the twin in packages/api (not in the middleware bundle) — hence
// the duplication; keep both implementations in sync.
function constantTimeEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (a == null || b == null) return false;
  // Iterate over the max length and fold the length delta into the accumulator
  // so we never early-return or branch on length.
  const max = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < max; i++) {
    // out-of-range indices read as 0; mismatch already non-zero on length diff.
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

/**
 * Stored page password vs submitted. The query param wins over the cookie (a
 * present-but-wrong `?pw=` must not fall through to a valid cookie), matching
 * the proxy's established behaviour. Empty/absent stored never authorizes.
 */
export function isPasswordAuthorized(input: {
  stored: string | null | undefined;
  queryPassword: string | null | undefined;
  cookiePassword: string | null | undefined;
}): boolean {
  if (!input.stored) return false;
  const submitted = input.queryPassword ?? input.cookiePassword;
  return constantTimeEqual(submitted, input.stored);
}

/** Authenticated email's domain is in the page's allow-list. */
export function isEmailDomainAuthorized(
  authEmail: string | null | undefined,
  authEmailDomains: string[] | null | undefined,
): boolean {
  // DNS domains are case-insensitive — normalise both sides before matching.
  const domain = authEmail?.split("@")[1]?.toLowerCase();
  const allowed = (authEmailDomains ?? []).map((d) => d.toLowerCase());
  return !!(domain && allowed.includes(domain));
}

/** Client IP falls within one of the page's allowed CIDR ranges. */
export function isIpAuthorized(
  clientIp: string | null | undefined,
  allowedIpRanges: string[] | null | undefined,
): boolean {
  return !!(clientIp && isIpAllowed(clientIp, allowedIpRanges ?? []));
}
