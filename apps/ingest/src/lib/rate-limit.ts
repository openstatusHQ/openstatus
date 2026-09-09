import { getLogger } from "@logtape/logtape";

const logger = getLogger(["ingest"]);

export type RateLimitVerdict = { allowed: boolean; remaining: number };

/**
 * Upstash is loaded lazily: `@openstatus/upstash` builds its client at module
 * scope and throws without credentials. Self-hosted deployments without Upstash
 * simply get no rate limiting rather than a broken ingest path.
 */
async function getRedis() {
  const { redis } = await import("@openstatus/upstash");
  return redis;
}

export async function rateLimit(args: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitVerdict> {
  try {
    const redis = await getRedis();
    const redisKey = `ingest:${args.key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, args.windowSeconds);
    return {
      allowed: count <= args.limit,
      remaining: Math.max(0, args.limit - count),
    };
  } catch (error) {
    logger.warn("rate limit unavailable, allowing request", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { allowed: true, remaining: args.limit };
  }
}
