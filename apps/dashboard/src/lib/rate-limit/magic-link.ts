import { incrWithTtl, redis } from "@openstatus/upstash";

const WINDOW_SECONDS = 60 * 10;
const MAX_PER_IP = 10;
const MAX_PER_EMAIL = 3;

/**
 * Throttle magic-link requests per sender IP and per target address: without
 * it the login form sends one email to any inbox per submit.
 *
 * Accepted trade-offs: refused requests count too, so three submits for
 * someone else's address block that inbox for the window (they keep GitHub
 * and Google); every request without a resolvable IP shares one bucket.
 * Auth.js already lowercases the identifier; the key does so again so direct
 * callers cannot multiply the per-address budget with case variants.
 */
export async function magicLinkRateLimit(args: {
  ip: string;
  email: string;
}): Promise<boolean> {
  try {
    const [byIp, byEmail] = await incrWithTtl(
      redis,
      [
        `ratelimit:magic-link:ip:${args.ip}`,
        `ratelimit:magic-link:email:${args.email.trim().toLowerCase()}`,
      ],
      WINDOW_SECONDS,
    );
    return byIp <= MAX_PER_IP && byEmail <= MAX_PER_EMAIL;
  } catch (e) {
    // Redis unavailable: allow the request rather than locking everyone out.
    console.warn("magic link rate limit unavailable, allowing request", e);
    return true;
  }
}
