// redis-free half of the limiter: importable from modules that must not
// evaluate the upstash client (it throws without credentials in dev)

export interface RateLimitTier {
  name: string; // part of the redis key, must be stable
  window: number; // in seconds
  limit: number; // max requests per window
}

export interface TieredRateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // timestamp when the window resets
  tier: RateLimitTier; // the tier that blocked, or the one closest to its limit
}

/**
 * Shared tiers for the public /play tools. The burst tier stops hammering, the
 * sustained tier stops automation that paces itself just under the burst limit.
 */
export const PLAY_RATE_LIMIT_TIERS: RateLimitTier[] = [
  { name: "burst", window: 60, limit: 3 },
  { name: "sustained", window: 3600, limit: 10 },
];

/** Index of the tier with the least headroom left, so headers report the real cap. */
export function tightestTierIndex(
  tiers: RateLimitTier[],
  counts: number[],
): number {
  let tightest = 0;
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].limit - counts[i] < tiers[tightest].limit - counts[tightest]) {
      tightest = i;
    }
  }
  return tightest;
}

/**
 * Decode the flat reply of RATELIMIT_TIERS_SCRIPT:
 * [blocked (1-based, 0 = admitted), ...counts, ...ttls]
 */
export function parseTieredResult(
  tiers: RateLimitTier[],
  reply: number[],
  now: number,
): TieredRateLimitResult {
  const counts = reply.slice(1, 1 + tiers.length);
  const ttls = reply.slice(1 + tiers.length, 1 + tiers.length * 2);

  // TTL replies -1 (no expiry) and -2 (no key); fall back to a full window
  const resetOf = (i: number) =>
    now + (ttls[i] > 0 ? ttls[i] * 1000 : tiers[i].window * 1000);

  const blocked = reply[0];
  if (blocked > 0) {
    const i = blocked - 1;
    return {
      success: false,
      limit: tiers[i].limit,
      remaining: 0,
      reset: resetOf(i),
      tier: tiers[i],
    };
  }

  const i = tightestTierIndex(tiers, counts);
  return {
    success: true,
    limit: tiers[i].limit,
    remaining: Math.max(0, tiers[i].limit - counts[i]),
    reset: resetOf(i),
    tier: tiers[i],
  };
}

function formatWindow(seconds: number): string {
  if (seconds === 60) return "minute";
  if (seconds === 3600) return "hour";
  if (seconds === 86400) return "day";
  return `${seconds} seconds`;
}

export function rateLimitMessage(tier: RateLimitTier): string {
  return `You have exceeded the rate limit of ${tier.limit} requests per ${formatWindow(tier.window)}`;
}

export function tieredRateLimitHeaders(result: {
  limit: number;
  remaining: number;
  reset: number; // ms epoch
}): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    // the header convention is unix seconds, unlike the ms epoch we pass around
    "X-RateLimit-Reset": Math.ceil(result.reset / 1000).toString(),
  };
}

export function retryAfterHeader(result: {
  reset: number;
}): Record<string, string> {
  return {
    "Retry-After": Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000),
    ).toString(),
  };
}
