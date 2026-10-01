import { incrWithTtl } from "./incr-with-ttl";

const WINDOW_SECONDS = 60 * 10;
const MAX_PER_IP = 10;
const MAX_PER_EMAIL = 3;

/**
 * Throttle magic-link requests per sender IP and per target address: without
 * it the login form sends one email to any inbox per submit.
 */
export async function magicLinkRateLimit(args: {
  ip: string;
  email: string;
}): Promise<boolean> {
  try {
    const [byIp, byEmail] = await incrWithTtl(
      [
        `ratelimit:magic-link:ip:${args.ip}`,
        `ratelimit:magic-link:email:${args.email}`,
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
