import { redis } from "@openstatus/upstash";

import {
  type RateLimitTier,
  type TieredRateLimitResult,
  blockedTierIndex,
  tightestTierIndex,
} from "@/lib/ratelimit-config";

export * from "@/lib/ratelimit-config";

interface RateLimitConfig {
  window: number; // in seconds
  limit: number; // max requests per window
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // timestamp when the window resets
}

/**
 * Simple fixed window rate limiter using Redis
 * @param identifier - Unique identifier for the rate limit (e.g., IP address)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function ratelimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();

  // Increment the counter
  const count = await redis.incr(key);

  // If this is the first request, set the expiry
  if (count === 1) {
    await redis.expire(key, config.window);
  }

  // Get the TTL to calculate reset time
  const ttl = await redis.ttl(key);
  const reset = now + (ttl > 0 ? ttl * 1000 : config.window * 1000);

  const success = count <= config.limit;
  const remaining = Math.max(0, config.limit - count);

  return {
    success,
    limit: config.limit,
    remaining,
    reset,
  };
}

/**
 * Fixed window rate limiter enforcing several windows at once. A request passes
 * only if every tier has room.
 * @param identifier - Unique identifier for the rate limit (e.g., IP address)
 * @param tiers - Windows to enforce, each with its own redis key
 */
export async function ratelimitTiers(
  identifier: string,
  tiers: RateLimitTier[],
): Promise<TieredRateLimitResult> {
  const now = Date.now();
  const keys = tiers.map((tier) => `ratelimit:${identifier}:${tier.name}`);

  // read before consuming: a request rejected by one tier must not burn quota in
  // the tiers that still had room, or a blocked client extends its own block
  const counts = await redis.mget<(number | null)[]>(...keys);

  const blocked = blockedTierIndex(tiers, counts);

  if (blocked !== -1) {
    const tier = tiers[blocked];
    const ttl = await redis.ttl(keys[blocked]);
    return {
      success: false,
      limit: tier.limit,
      remaining: 0,
      reset: now + (ttl > 0 ? ttl * 1000 : tier.window * 1000),
      tier,
    };
  }

  const pipeline = redis.pipeline();
  for (const key of keys) pipeline.incr(key);
  // NX keeps the window anchored to its first request instead of sliding
  for (const [i, key] of keys.entries()) {
    pipeline.expire(key, tiers[i].window, "NX");
  }
  for (const key of keys) pipeline.ttl(key);

  // results are ordered as issued: n incrs, then n expires, then n ttls
  const results = await pipeline.exec<number[]>();
  const counted = results.slice(0, tiers.length);
  const ttls = results.slice(tiers.length * 2);

  const tightest = tightestTierIndex(tiers, counted);
  const tier = tiers[tightest];
  const ttl = ttls[tightest];

  return {
    success: true,
    limit: tier.limit,
    remaining: Math.max(0, tier.limit - counted[tightest]),
    reset: now + (ttl > 0 ? ttl * 1000 : tier.window * 1000),
    tier,
  };
}

/**
 * Extract IP address from request headers
 * @param headers - Request headers
 * @returns IP address or null
 */
export function getClientIP(headers: Headers): string | null {
  // Check x-real-ip first (commonly set by Vercel, Cloudflare, etc.)
  const realIP = headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Check x-forwarded-for (can contain multiple IPs, take the first one)
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return null;
}
