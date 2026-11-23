import { beforeEach, describe, expect, test, vi } from "vitest";

import { resetRedisCounters } from "../test/upstash.mock";
import {
  MAX_PAGE_PASSWORD_FAILURES,
  pagePasswordRateLimit,
} from "./page-password-rate-limit";

const attempt = { scope: "login" as const, slug: "acme", ip: "10.0.0.1" };

beforeEach(() => resetRedisCounters());

describe("pagePasswordRateLimit", () => {
  test("locks after the maximum number of failures", async () => {
    const limiter = pagePasswordRateLimit();
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES - 1; i++) {
      await limiter.recordFailure(attempt);
    }
    expect(await limiter.isLocked(attempt)).toBe(false);
    await limiter.recordFailure(attempt);
    expect(await limiter.isLocked(attempt)).toBe(true);
  });

  test("keeps separate budgets per IP, host and scope", async () => {
    const limiter = pagePasswordRateLimit();
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES; i++) {
      await limiter.recordFailure(attempt);
    }
    expect(await limiter.isLocked(attempt)).toBe(true);
    expect(await limiter.isLocked({ ...attempt, ip: "10.0.0.2" })).toBe(false);
    expect(await limiter.isLocked({ ...attempt, slug: "other" })).toBe(false);
    expect(await limiter.isLocked({ ...attempt, scope: "check" })).toBe(false);
  });

  test("requests without an IP share one bucket per host", async () => {
    const limiter = pagePasswordRateLimit();
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES; i++) {
      await limiter.recordFailure({ ...attempt, ip: null });
    }
    expect(await limiter.isLocked({ ...attempt, ip: null })).toBe(true);
    expect(await limiter.isLocked(attempt)).toBe(false);
  });

  test("fails open when Redis is unavailable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const limiter = pagePasswordRateLimit({
      get: () => Promise.reject(new Error("down")),
      eval: () => Promise.reject(new Error("down")),
    });
    expect(await limiter.isLocked(attempt)).toBe(false);
    warn.mockRestore();
  });
});
