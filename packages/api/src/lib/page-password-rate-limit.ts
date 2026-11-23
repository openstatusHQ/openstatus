import { incrWithTtl, redis } from "@openstatus/upstash";

const WINDOW_SECONDS = 60 * 15;
export const MAX_PAGE_PASSWORD_FAILURES = 10;

type Client = Parameters<typeof incrWithTtl>[0] & {
  get: (key: string) => Promise<unknown>;
};

type Attempt = { scope: "login" | "check"; slug: string; ip: string | null };

/**
 * Failed password guesses per (scope, page host, client IP). Only failures
 * count, so feeds polled with a valid cookie never use up the budget. The login
 * form and the server-side check keep separate budgets, so a stale feed cookie
 * cannot lock its IP out of logging in. Requests without an IP share a bucket.
 */
export function pagePasswordRateLimit(client: Client = redis) {
  const key = ({ scope, slug, ip }: Attempt) =>
    `ratelimit:page-password:${scope}:${slug}:${ip ?? "unknown"}`;

  return {
    async isLocked(attempt: Attempt) {
      try {
        const count = Number((await client.get(key(attempt))) ?? 0);
        return count >= MAX_PAGE_PASSWORD_FAILURES;
      } catch (e) {
        // Redis unavailable: allow the attempt rather than lock everyone out.
        console.warn("page password rate limit unavailable", e);
        return false;
      }
    },
    async recordFailure(attempt: Attempt) {
      try {
        await incrWithTtl(client, [key(attempt)], WINDOW_SECONDS);
      } catch (e) {
        console.warn("page password rate limit unavailable", e);
      }
    },
  };
}
