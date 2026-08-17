import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  PLAY_RATE_LIMIT_TIERS,
  parseTieredResult,
  rateLimitMessage,
  retryAfterHeader,
  tieredRateLimitHeaders,
  tightestTierIndex,
} from "./ratelimit-config";

const [BURST, SUSTAINED] = PLAY_RATE_LIMIT_TIERS;
const NOW = 1_760_000_000_000;

/** Reply shape of RATELIMIT_TIERS_SCRIPT for the two play tiers. */
function reply(
  blocked: number,
  counts: [number, number],
  ttls: [number, number],
) {
  return [blocked, ...counts, ...ttls];
}

describe("parseTieredResult", () => {
  test("admits a first request and reports the burst tier", () => {
    const result = parseTieredResult(
      PLAY_RATE_LIMIT_TIERS,
      reply(0, [1, 1], [60, 3600]),
      NOW,
    );
    expect(result.success).toBe(true);
    expect(result.tier).toEqual(BURST);
    expect(result.remaining).toBe(2);
    expect(result.reset).toBe(NOW + 60_000);
  });

  test("reports the sustained tier once it has the least headroom", () => {
    const result = parseTieredResult(
      PLAY_RATE_LIMIT_TIERS,
      reply(0, [1, 9], [58, 1200]),
      NOW,
    );
    expect(result.success).toBe(true);
    expect(result.tier).toEqual(SUSTAINED);
    expect(result.remaining).toBe(1);
    expect(result.reset).toBe(NOW + 1_200_000);
  });

  test("surfaces the burst tier when it is what blocked", () => {
    const result = parseTieredResult(
      PLAY_RATE_LIMIT_TIERS,
      reply(1, [3, 3], [42, 3400]),
      NOW,
    );
    expect(result.success).toBe(false);
    expect(result.tier).toEqual(BURST);
    expect(result.limit).toBe(3);
    expect(result.remaining).toBe(0);
    expect(result.reset).toBe(NOW + 42_000);
  });

  // the case that motivated the tiers: paced automation never trips the burst
  // tier, so only the sustained tier can stop it
  test("surfaces the sustained tier when paced automation is blocked", () => {
    const result = parseTieredResult(
      PLAY_RATE_LIMIT_TIERS,
      reply(2, [1, 10], [30, 2400]),
      NOW,
    );
    expect(result.success).toBe(false);
    expect(result.tier).toEqual(SUSTAINED);
    expect(result.limit).toBe(10);
    expect(result.reset).toBe(NOW + 2_400_000);
  });

  test("falls back to a full window when redis reports no ttl", () => {
    const blocked = parseTieredResult(
      PLAY_RATE_LIMIT_TIERS,
      reply(1, [3, 3], [-1, -2]),
      NOW,
    );
    expect(blocked.reset).toBe(NOW + BURST.window * 1000);
  });
});

describe("tightestTierIndex", () => {
  test("reports the burst tier while it is the binding constraint", () => {
    expect(tightestTierIndex(PLAY_RATE_LIMIT_TIERS, [2, 4])).toBe(0);
  });

  test("reports the sustained tier once it has the least headroom", () => {
    expect(tightestTierIndex(PLAY_RATE_LIMIT_TIERS, [1, 10])).toBe(1);
  });
});

describe("rateLimitMessage", () => {
  test("names the window that tripped", () => {
    expect(rateLimitMessage(BURST)).toBe(
      "You have exceeded the rate limit of 3 requests per minute",
    );
    expect(rateLimitMessage(SUSTAINED)).toBe(
      "You have exceeded the rate limit of 10 requests per hour",
    );
  });
});

describe("tieredRateLimitHeaders", () => {
  test("emits the reset as unix seconds, not the ms epoch", () => {
    const headers = tieredRateLimitHeaders({
      limit: 3,
      remaining: 0,
      reset: NOW,
    });
    expect(headers["X-RateLimit-Reset"]).toBe("1760000000");
  });
});

describe("retryAfterHeader", () => {
  test("is at least one second even when the reset is in the past", () => {
    expect(retryAfterHeader({ reset: Date.now() - 5_000 })["Retry-After"]).toBe(
      "1",
    );
  });

  test("rounds up to the remaining seconds", () => {
    const header = retryAfterHeader({ reset: Date.now() + 42_400 })[
      "Retry-After"
    ];
    expect(Number(header)).toBeGreaterThan(41);
    expect(Number(header)).toBeLessThanOrEqual(43);
  });
});
