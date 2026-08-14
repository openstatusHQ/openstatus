import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  PLAY_RATE_LIMIT_TIERS,
  blockedTierIndex,
  rateLimitMessage,
  retryAfterHeader,
  tightestTierIndex,
} from "./ratelimit-config";

const [BURST, SUSTAINED] = PLAY_RATE_LIMIT_TIERS;

describe("blockedTierIndex", () => {
  test("allows a first request with no counters set", () => {
    expect(blockedTierIndex(PLAY_RATE_LIMIT_TIERS, [null, null])).toBe(-1);
  });

  test("allows a request while every tier still has room", () => {
    expect(blockedTierIndex(PLAY_RATE_LIMIT_TIERS, [2, 9])).toBe(-1);
  });

  test("blocks on the burst tier at 3 within the minute", () => {
    expect(blockedTierIndex(PLAY_RATE_LIMIT_TIERS, [3, 3])).toBe(0);
  });

  // the case that motivated the tiers: paced automation never trips the burst
  // tier, so only the sustained tier can stop it
  test("blocks paced automation on the sustained tier", () => {
    expect(blockedTierIndex(PLAY_RATE_LIMIT_TIERS, [1, 10])).toBe(1);
  });

  test("one request per minute is blocked after ten requests", () => {
    const allowed = Array.from({ length: 20 }, (_, i) => i).filter(
      // a 1/min pace means the burst counter is never above 1
      (i) => blockedTierIndex(PLAY_RATE_LIMIT_TIERS, [1, i]) === -1,
    );
    expect(allowed.length).toBe(SUSTAINED.limit);
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
