import {
  type RateLimitTier,
  type TieredRateLimitResult,
  parseTieredResult,
} from "@/lib/ratelimit-config";

export * from "@/lib/ratelimit-config";

// @openstatus/upstash builds its client at module scope and throws without
// credentials, so it is loaded lazily to keep this module importable in dev
async function getRedis() {
  const { redis } = await import("@openstatus/upstash");
  return redis;
}

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
  const redis = await getRedis();

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
 * Admission must be atomic: checking counters and then incrementing in a second
 * round trip lets concurrent requests all observe room and all pass. Consuming
 * only when every tier has room is what keeps a rejected request from burning
 * quota in the tiers that were still under their limit.
 *
 * KEYS: one per tier. ARGV: limit, window per tier.
 * Reply: [blocked (1-based, 0 = admitted), ...counts, ...ttls]
 */
const RATELIMIT_TIERS_SCRIPT = `
local n = #KEYS
local blocked = 0
for i = 1, n do
  local limit = tonumber(ARGV[(i - 1) * 2 + 1])
  local count = tonumber(redis.call('GET', KEYS[i]) or '0')
  if count >= limit then
    blocked = i
    break
  end
end

local reply = {blocked}
for i = 1, n do
  local count
  if blocked == 0 then
    count = redis.call('INCR', KEYS[i])
    -- anchor the window to its first request instead of letting it slide
    if count == 1 then
      redis.call('EXPIRE', KEYS[i], tonumber(ARGV[(i - 1) * 2 + 2]))
    end
  else
    count = tonumber(redis.call('GET', KEYS[i]) or '0')
  end
  reply[#reply + 1] = count
end
for i = 1, n do
  reply[#reply + 1] = redis.call('TTL', KEYS[i])
end
return reply
`;

/**
 * Fixed window rate limiter enforcing several windows at once. A request passes
 * only if every tier has room. Not enforced outside production, so the /play
 * tools stay usable locally without Upstash credentials.
 * @param identifier - Unique identifier for the rate limit (e.g., IP address)
 * @param tiers - Windows to enforce, each with its own redis key
 */
export async function ratelimitTiers(
  identifier: string,
  tiers: RateLimitTier[],
): Promise<TieredRateLimitResult> {
  const now = Date.now();

  if (process.env.NODE_ENV !== "production") {
    const tier = tiers[0];
    return {
      success: true,
      limit: tier.limit,
      remaining: tier.limit,
      reset: now + tier.window * 1000,
      tier,
    };
  }

  const keys = tiers.map((tier) => `ratelimit:${identifier}:${tier.name}`);
  const args = tiers.flatMap((tier) => [tier.limit, tier.window]);

  const redis = await getRedis();
  const reply = await redis.eval<number[], number[]>(
    RATELIMIT_TIERS_SCRIPT,
    keys,
    args,
  );

  return parseTieredResult(tiers, reply, now);
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
