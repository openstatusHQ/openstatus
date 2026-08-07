import type { Redis } from "@openstatus/upstash";
import type { Context } from "hono";
import type { Store } from "hono-rate-limiter";
import { getConnInfo } from "hono/deno";

// x-forwarded-for is attacker-spoofable when the client is direct; the header
// only constrains clients routed through the trusted edge that sets it.
export function parseRateLimitKey(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  try {
    const { remote } = getConnInfo(c);
    if (remote.address) return remote.address;
  } catch {
    // Non-Deno runtime (tests, adapters) exposes no socket info.
  }
  // Fail open when no address is observable (non-Deno runtime, or a client not
  // routed through a trusted proxy): the per-request UUID never trips the
  // limit, so these clients are NOT rate limited. Put a trusted proxy in front
  // (setting x-forwarded-for) for the limit to apply.
  return crypto.randomUUID();
}

// Namespaced so limiter keys can never collide with the raw-slug page cache.
export const STATUS_RATE_LIMIT_KEY_PREFIX = "rl:";

// incr + expire are separate commands, so a crash between them can leave a
// TTL-less key; harmless since the key only exists once a client has hit us.
export function createStatusRateLimitStore(
  redis: Redis,
  windowMs: number,
): Store {
  const ttlSeconds = windowMs / 1000;
  return {
    localKeys: false,
    increment: async (key) => {
      const namespaced = `${STATUS_RATE_LIMIT_KEY_PREFIX}${key}`;
      const totalHits = await redis.incr(namespaced);
      if (totalHits === 1) await redis.expire(namespaced, ttlSeconds);
      return { totalHits, resetTime: undefined };
    },
    decrement: async (key) => {
      const namespaced = `${STATUS_RATE_LIMIT_KEY_PREFIX}${key}`;
      const current = Number(await redis.get(namespaced)) || 0;
      if (current > 0) await redis.decr(namespaced);
    },
    resetKey: async (key) => {
      await redis.del(`${STATUS_RATE_LIMIT_KEY_PREFIX}${key}`);
    },
  };
}