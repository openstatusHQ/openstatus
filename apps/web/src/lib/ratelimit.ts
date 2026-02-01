import { redis } from "@openstatus/upstash";

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
