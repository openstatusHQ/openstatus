import { isIpAllowed } from "./is-ip-allowed";

/**
 * Pure allow/deny predicates shared by the proxy gate chain (which wraps them in
 * redirects) and the markdown route gate (which wraps them in status codes).
 * Keeping the authorization core here is the guarantee that the two surfaces
 * cannot drift — only their wrapping behaviour differs.
 */

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
  return submitted === input.stored;
}

/** Authenticated email's domain is in the page's allow-list. */
export function isEmailDomainAuthorized(
  authEmail: string | null | undefined,
  authEmailDomains: string[] | null | undefined,
): boolean {
  const domain = authEmail?.split("@")[1];
  return !!(domain && (authEmailDomains ?? []).includes(domain));
}

/** Client IP falls within one of the page's allowed CIDR ranges. */
export function isIpAuthorized(
  clientIp: string | null | undefined,
  allowedIpRanges: string[] | null | undefined,
): boolean {
  return !!(clientIp && isIpAllowed(clientIp, allowedIpRanges ?? []));
}
