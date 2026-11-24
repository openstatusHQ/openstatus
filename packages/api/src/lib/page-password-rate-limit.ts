import { addDistinctWithTtl, countDistinct, redis } from "@openstatus/upstash";

const WINDOW_SECONDS = 60 * 15;
export const MAX_PAGE_PASSWORD_FAILURES = 10;
// Longer than any hostname; input slugs are otherwise unbounded.
const MAX_SLUG_LENGTH = 255;

type Client = Parameters<typeof countDistinct>[0];

export type PasswordAttempt = {
  scope: "login" | "check";
  slug: string;
  ip: string | null;
};

function redisConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
}

const noLimit = {
  isLocked: async (_: PasswordAttempt) => false,
  recordFailure: async (_: PasswordAttempt, _password: string) => ({
    locked: false,
  }),
};

// Only a digest of the wrong value is kept, so equal guesses dedupe without
// storing what was typed.
async function guessDigest(slug: string, password: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${slug}\0${password}`),
  );
  return Array.from(new Uint8Array(bytes).slice(0, 12), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Distinct wrong passwords per (scope, page host, client IP) in a 15 minute
 * window. A right password only reads the count, so concurrent visitors never
 * hold the limit; a repeated wrong value (a stale cookie, a polling tab) counts
 * once. Callers compare first: a wrong password calls `recordFailure`, a right
 * one `isLocked`. Each is one Redis call, so a burst cannot slip past the cap.
 * Requests without an IP share a bucket per host.
 */
export function pagePasswordRateLimit(client?: Client) {
  // Redis is optional when self-hosting, and the client retries for seconds
  // against a missing URL: without one, there is no limit.
  if (!client && !redisConfigured()) return noLimit;
  const redisClient = client ?? redis;
  const key = ({ scope, slug, ip }: PasswordAttempt) =>
    `ratelimit:page-password:${scope}:${slug.slice(0, MAX_SLUG_LENGTH)}:${ip ?? "unknown"}`;

  return {
    async isLocked(attempt: PasswordAttempt) {
      try {
        const count = await countDistinct(redisClient, key(attempt));
        return count >= MAX_PAGE_PASSWORD_FAILURES;
      } catch (e) {
        // Redis unavailable: allow the attempt rather than lock everyone out.
        console.warn("page password rate limit unavailable", e);
        return false;
      }
    },
    async recordFailure(attempt: PasswordAttempt, password: string) {
      try {
        const count = await addDistinctWithTtl(
          redisClient,
          key(attempt),
          await guessDigest(attempt.slug, password),
          WINDOW_SECONDS,
        );
        return { locked: count > MAX_PAGE_PASSWORD_FAILURES };
      } catch (e) {
        console.warn("page password rate limit unavailable", e);
        return { locked: false };
      }
    },
  };
}
