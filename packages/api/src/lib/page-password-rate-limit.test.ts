import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  redisKeyCount,
  redisSetSize,
  resetRedisCounters,
} from "../test/upstash.mock";
import {
  MAX_PAGE_PASSWORD_FAILURES,
  pagePasswordRateLimit,
} from "./page-password-rate-limit";

const attempt = { slug: "acme", ip: "10.0.0.1" };

beforeEach(() => resetRedisCounters());

/** Record `n` distinct wrong passwords; returns the last `locked`. */
async function failDistinct(
  limiter: ReturnType<typeof pagePasswordRateLimit>,
  n: number,
  a = attempt,
) {
  let locked = false;
  for (let i = 0; i < n; i++) {
    ({ locked } = await limiter.recordFailure(a, `guess-${i}`));
  }
  return locked;
}

describe("pagePasswordRateLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("locks once the maximum number of distinct wrong passwords is recorded", async () => {
    const limiter = pagePasswordRateLimit();
    expect(await failDistinct(limiter, MAX_PAGE_PASSWORD_FAILURES - 1)).toBe(
      false,
    );
    expect(await limiter.isLocked(attempt)).toBe(false);
    await limiter.recordFailure(attempt, "one-more");
    expect(await limiter.isLocked(attempt)).toBe(true);
  });

  test("recordFailure reports locked once past the maximum", async () => {
    const limiter = pagePasswordRateLimit();
    expect(await failDistinct(limiter, MAX_PAGE_PASSWORD_FAILURES)).toBe(false);
    expect((await limiter.recordFailure(attempt, "past-the-cap")).locked).toBe(
      true,
    );
  });

  test("a repeated wrong password counts once", async () => {
    const limiter = pagePasswordRateLimit();
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES * 3; i++) {
      await limiter.recordFailure(attempt, "stale-cookie");
    }
    expect(await limiter.isLocked(attempt)).toBe(false);
  });

  test("checking the lock never counts", async () => {
    const limiter = pagePasswordRateLimit();
    await Promise.all(
      Array.from({ length: MAX_PAGE_PASSWORD_FAILURES * 5 }, () =>
        limiter.isLocked(attempt),
      ),
    );
    expect(await limiter.isLocked(attempt)).toBe(false);
    expect(redisKeyCount()).toBe(0);
  });

  test("a locked bucket stores no further guesses", async () => {
    const limiter = pagePasswordRateLimit();
    await failDistinct(limiter, MAX_PAGE_PASSWORD_FAILURES);
    for (let i = 0; i < 100; i++) {
      expect((await limiter.recordFailure(attempt, `more-${i}`)).locked).toBe(
        true,
      );
    }
    expect(redisSetSize(`ratelimit:page-password:acme:10.0.0.1`)).toBe(
      MAX_PAGE_PASSWORD_FAILURES,
    );
  });

  test("a parallel burst of distinct guesses locks the bucket", async () => {
    const limiter = pagePasswordRateLimit();
    await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        limiter.recordFailure(attempt, `burst-${i}`),
      ),
    );
    expect(await limiter.isLocked(attempt)).toBe(true);
  });

  test("unlocks after the window", async () => {
    vi.useFakeTimers();
    const limiter = pagePasswordRateLimit();
    await failDistinct(limiter, MAX_PAGE_PASSWORD_FAILURES);
    expect(await limiter.isLocked(attempt)).toBe(true);
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(await limiter.isLocked(attempt)).toBe(false);
  });

  test("keeps separate budgets per IP and page", async () => {
    const limiter = pagePasswordRateLimit();
    await failDistinct(limiter, MAX_PAGE_PASSWORD_FAILURES);
    expect(await limiter.isLocked(attempt)).toBe(true);
    expect(await limiter.isLocked({ ...attempt, ip: "10.0.0.2" })).toBe(false);
    expect(await limiter.isLocked({ ...attempt, slug: "other" })).toBe(false);
  });

  test("requests without an IP share one bucket per host", async () => {
    const limiter = pagePasswordRateLimit();
    const noIp = { ...attempt, ip: null };
    await failDistinct(limiter, MAX_PAGE_PASSWORD_FAILURES, noIp);
    expect(await limiter.isLocked(noIp)).toBe(true);
    expect(await limiter.isLocked(attempt)).toBe(false);
  });

  test("stores a digest, never the password, and bounds the key", async () => {
    const calls: { keys: string[]; args: unknown[] }[] = [];
    const limiter = pagePasswordRateLimit({
      eval: <TArgs extends unknown[], TData>(
        _script: string,
        keys: string[],
        args: TArgs,
      ) => {
        calls.push({ keys, args });
        return Promise.resolve(1 as TData);
      },
    });
    await limiter.recordFailure(
      { ...attempt, slug: "x".repeat(10_000) },
      "hunter2",
    );
    const [member] = calls[0]?.args ?? [];
    expect(typeof member).toBe("string");
    expect(member).not.toContain("hunter2");
    expect(member).toMatch(/^[0-9a-f]{24}$/);
    expect(calls[0]?.keys[0]?.length).toBeLessThan(400);
  });

  test("equal passwords give equal digests per page, different across pages", async () => {
    const members: unknown[] = [];
    const limiter = pagePasswordRateLimit({
      eval: <TArgs extends unknown[], TData>(
        _script: string,
        _keys: string[],
        args: TArgs,
      ) => {
        members.push(args[0]);
        return Promise.resolve(1 as TData);
      },
    });
    await limiter.recordFailure(attempt, "same");
    await limiter.recordFailure(attempt, "same");
    await limiter.recordFailure({ ...attempt, slug: "other" }, "same");
    expect(members[0]).toBe(members[1]);
    expect(members[2]).not.toBe(members[0]);
  });

  test("is a no-op when no Redis URL is configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("KV_REST_API_URL", "");
    const limiter = pagePasswordRateLimit();
    expect(await failDistinct(limiter, MAX_PAGE_PASSWORD_FAILURES * 2)).toBe(
      false,
    );
    expect(await limiter.isLocked(attempt)).toBe(false);
  });

  test("fails open when Redis is unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const limiter = pagePasswordRateLimit({
      eval: () => Promise.reject(new Error("down")),
    });
    expect(await limiter.isLocked(attempt)).toBe(false);
    expect((await limiter.recordFailure(attempt, "x")).locked).toBe(false);
  });
});
