import { redis } from "@openstatus/upstash";

const WINDOW_SECONDS = 60 * 10;
const MAX_ATTEMPTS = 10;

// INCR + conditional EXPIRE in one round-trip so a crash between the two can't
// leave a TTL-less key. Mirrors `rate-limit/chat.ts`.
const INCR_WITH_TTL = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
  end
  return count
`;

/**
 * Throttle unauthenticated SSO domain lookups — without this the login form is
 * a free oracle for enumerating which companies have SSO configured.
 */
export async function ssoLookupRateLimit(ip: string): Promise<boolean> {
  try {
    const count = await redis.eval<[number], number>(
      INCR_WITH_TTL,
      [`ratelimit:sso-lookup:${ip}`],
      [WINDOW_SECONDS],
    );
    return count <= MAX_ATTEMPTS;
  } catch {
    // Redis unavailable: allow the lookup rather than locking everyone out of
    // SSO. The verified-domain check downstream is the real security boundary.
    return true;
  }
}
