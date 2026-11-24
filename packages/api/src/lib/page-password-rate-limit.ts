import { decrOrDelete, incrWithTtl, redis } from "@openstatus/upstash";

const WINDOW_SECONDS = 60 * 15;
export const MAX_PAGE_PASSWORD_FAILURES = 10;
// Longer than any hostname; input slugs are otherwise unbounded.
const MAX_SLUG_LENGTH = 255;

type Client = Parameters<typeof incrWithTtl>[0];

export type PasswordAttempt = {
  scope: "login" | "check";
  slug: string;
  ip: string | null;
};

export type PasswordAttemptSlot = {
  locked: boolean;
  /** Give the slot back: the attempt was not a wrong password. */
  release(): Promise<void>;
};

function redisConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
}

const freeSlot: PasswordAttemptSlot = {
  locked: false,
  release: async () => {},
};
const lockedSlot: PasswordAttemptSlot = {
  locked: true,
  release: async () => {},
};

/**
 * Failed password guesses per (scope, page host, client IP). Each attempt
 * reserves a slot first, so a parallel burst cannot slip past the cap; a slot
 * comes back unless the password was wrong. The login form and the server-side
 * check keep separate budgets, so a stale feed cookie cannot lock its IP out of
 * logging in. Requests without an IP share a bucket.
 */
export function pagePasswordRateLimit(client?: Client) {
  // Redis is optional when self-hosting, and the client retries for seconds
  // against a missing URL: without one, there is no limit.
  if (!client && !redisConfigured()) {
    return { reserve: async (_: PasswordAttempt) => freeSlot };
  }
  const redisClient = client ?? redis;
  const key = ({ scope, slug, ip }: PasswordAttempt) =>
    `ratelimit:page-password:${scope}:${slug.slice(0, MAX_SLUG_LENGTH)}:${ip ?? "unknown"}`;

  return {
    async reserve(attempt: PasswordAttempt): Promise<PasswordAttemptSlot> {
      const k = key(attempt);
      let count: number;
      try {
        [count] = await incrWithTtl(redisClient, [k], WINDOW_SECONDS);
      } catch (e) {
        // Redis unavailable: allow the attempt rather than lock everyone out.
        console.warn("page password rate limit unavailable", e);
        return freeSlot;
      }
      const giveBack = async () => {
        try {
          await decrOrDelete(redisClient, k);
          return true;
        } catch (e) {
          console.warn("page password rate limit unavailable", e);
          return false;
        }
      };
      // A refused attempt gives its slot straight back so the count stays put.
      // If that fails, released slots may not have come back either, so the
      // count can't be trusted: fail open, as when Redis is down.
      if (count > MAX_PAGE_PASSWORD_FAILURES) {
        return (await giveBack()) ? lockedSlot : freeSlot;
      }
      return {
        locked: false,
        release: async () => {
          await giveBack();
        },
      };
    },
  };
}
