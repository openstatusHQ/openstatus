import {
  PLAY_RATE_LIMIT_TIERS,
  type RateLimitTier,
  rateLimitMessage,
  retryAfterHeader,
  tieredRateLimitHeaders,
} from "@/lib/ratelimit-config";

type CdnRateLimit =
  | { status: "skipped" }
  | { status: "no-client-ip" }
  | {
      status: "ok" | "limited";
      limit: number;
      remaining: number;
      reset: number;
      tier: RateLimitTier;
    };

// dev runs without Upstash credentials and the redis client throws at module
// evaluation, so the limiter is only imported (and enforced) in production
export async function rateLimitCdnRequest(
  prefix: string,
  headers: Headers,
): Promise<CdnRateLimit> {
  if (process.env.NODE_ENV !== "production") return { status: "skipped" };

  const { getClientIP, ratelimitTiers } = await import("@/lib/ratelimit");

  const clientIP = getClientIP(headers);
  if (!clientIP) return { status: "no-client-ip" };

  const rl = await ratelimitTiers(
    `${prefix}:${clientIP}`,
    PLAY_RATE_LIMIT_TIERS,
  );

  return {
    status: rl.success ? "ok" : "limited",
    limit: rl.limit,
    remaining: rl.remaining,
    reset: rl.reset,
    tier: rl.tier,
  };
}

export function rateLimitHeaders(rl: CdnRateLimit): Record<string, string> {
  if (rl.status !== "ok" && rl.status !== "limited") return {};
  return tieredRateLimitHeaders(rl);
}

export function rateLimitExceeded(
  rl: Extract<CdnRateLimit, { tier: RateLimitTier }>,
) {
  return {
    message: rateLimitMessage(rl.tier),
    headers: { ...tieredRateLimitHeaders(rl), ...retryAfterHeader(rl) },
  };
}
