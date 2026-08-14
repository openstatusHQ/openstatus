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

/** Index of the first tier already at its limit, or -1 when all have room. */
export function blockedTierIndex(
  tiers: RateLimitTier[],
  counts: (number | null)[],
): number {
  return tiers.findIndex((tier, i) => (counts[i] ?? 0) >= tier.limit);
}

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
  reset: number;
}): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
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
