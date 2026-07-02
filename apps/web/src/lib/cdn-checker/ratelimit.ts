export const RATE_LIMIT_WINDOW = 60;
export const MAX_REQUESTS_PER_WINDOW = 3;

type CdnRateLimit =
  | { status: "skipped" }
  | { status: "no-client-ip" }
  | {
      status: "ok" | "limited";
      limit: number;
      remaining: number;
      reset: number;
    };

// dev runs without Upstash credentials and the redis client throws at module
// evaluation, so the limiter is only imported (and enforced) in production
export async function rateLimitCdnRequest(
  prefix: string,
  headers: Headers,
): Promise<CdnRateLimit> {
  if (process.env.NODE_ENV !== "production") return { status: "skipped" };

  const { getClientIP, ratelimit } = await import("@/lib/ratelimit");

  const clientIP = getClientIP(headers);
  if (!clientIP) return { status: "no-client-ip" };

  const rl = await ratelimit(`${prefix}:${clientIP}`, {
    window: RATE_LIMIT_WINDOW,
    limit: MAX_REQUESTS_PER_WINDOW,
  });

  return {
    status: rl.success ? "ok" : "limited",
    limit: rl.limit,
    remaining: rl.remaining,
    reset: rl.reset,
  };
}

export function rateLimitHeaders(rl: CdnRateLimit): Record<string, string> {
  if (rl.status !== "ok" && rl.status !== "limited") return {};
  return {
    "X-RateLimit-Limit": rl.limit.toString(),
    "X-RateLimit-Remaining": rl.remaining.toString(),
    "X-RateLimit-Reset": rl.reset.toString(),
  };
}
