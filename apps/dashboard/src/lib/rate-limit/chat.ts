import { redis } from "@openstatus/upstash";

/**
 * Per-user fixed-window rate limit for the dashboard chat surface.
 * Naive `INCR + EXPIRE` rather than `@upstash/ratelimit` to keep the
 * dashboard's dep tree slim — the chat protects LLM cost, not a request
 * tier, and the precision of a sliding window is overkill for a 50-per-
 * day cap. Mirrors `apps/web/src/lib/ratelimit.ts`.
 */
export const CHAT_RATE_LIMIT = {
  window: 60 * 60 * 24, // 24h in seconds
  limit: 50,
} as const;

export type ChatRateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // ms epoch when the window resets
};

export async function chatRateLimit(args: {
  userId: number;
}): Promise<ChatRateLimitResult> {
  const key = `ratelimit:chat:user:${args.userId}`;
  const now = Date.now();
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, CHAT_RATE_LIMIT.window);
  }
  const ttl = await redis.ttl(key);
  const reset = now + (ttl > 0 ? ttl * 1000 : CHAT_RATE_LIMIT.window * 1000);
  return {
    success: count <= CHAT_RATE_LIMIT.limit,
    limit: CHAT_RATE_LIMIT.limit,
    remaining: Math.max(0, CHAT_RATE_LIMIT.limit - count),
    reset,
  };
}
