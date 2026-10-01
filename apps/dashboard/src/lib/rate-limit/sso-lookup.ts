import { incrWithTtl, redis } from "@openstatus/upstash";

const WINDOW_SECONDS = 60 * 10;
const MAX_ATTEMPTS = 10;

/**
 * Throttle unauthenticated SSO domain lookups — without this the login form is
 * a free oracle for enumerating which companies have SSO configured.
 */
export async function ssoLookupRateLimit(ip: string): Promise<boolean> {
  try {
    const [count] = await incrWithTtl(
      redis,
      [`ratelimit:sso-lookup:${ip}`],
      WINDOW_SECONDS,
    );
    return count <= MAX_ATTEMPTS;
  } catch {
    // Redis unavailable: allow the lookup rather than locking everyone out of
    // SSO. The verified-domain check downstream is the real security boundary.
    return true;
  }
}
