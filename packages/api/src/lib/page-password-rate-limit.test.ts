import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { resetRedisCounters } from "../test/upstash.mock";
import {
  MAX_PAGE_PASSWORD_FAILURES,
  pagePasswordRateLimit,
} from "./page-password-rate-limit";

const attempt = { scope: "login" as const, slug: "acme", ip: "10.0.0.1" };

beforeEach(() => resetRedisCounters());

describe("pagePasswordRateLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /** Reserve and keep the slot, as a wrong password does. */
  async function fail(limiter = pagePasswordRateLimit(), a = attempt) {
    return (await limiter.reserve(a)).locked;
  }

  test("locks once the maximum number of failures is kept", async () => {
    const limiter = pagePasswordRateLimit();
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES; i++) {
      expect(await fail(limiter)).toBe(false);
    }
    expect(await fail(limiter)).toBe(true);
  });

  test("released slots do not count", async () => {
    const limiter = pagePasswordRateLimit();
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES * 2; i++) {
      const slot = await limiter.reserve(attempt);
      expect(slot.locked).toBe(false);
      await slot.release();
    }
  });

  test("a refused attempt does not grow the count", async () => {
    const limiter = pagePasswordRateLimit();
    const kept = [];
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES; i++) {
      kept.push(await limiter.reserve(attempt));
    }
    for (let i = 0; i < 5; i++) expect(await fail(limiter)).toBe(true);
    // Giving back one kept slot frees exactly one: the refusals added nothing.
    await kept[0]?.release();
    expect(await fail(limiter)).toBe(false);
    expect(await fail(limiter)).toBe(true);
  });

  test("a parallel burst cannot pass the cap", async () => {
    const limiter = pagePasswordRateLimit();
    const slots = await Promise.all(
      Array.from({ length: 50 }, () => limiter.reserve(attempt)),
    );
    expect(slots.filter((s) => !s.locked)).toHaveLength(
      MAX_PAGE_PASSWORD_FAILURES,
    );
  });

  test("unlocks after the window", async () => {
    vi.useFakeTimers();
    const limiter = pagePasswordRateLimit();
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES; i++) await fail(limiter);
    expect(await fail(limiter)).toBe(true);
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(await fail(limiter)).toBe(false);
  });

  test("keeps separate budgets per IP, host and scope", async () => {
    const limiter = pagePasswordRateLimit();
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES; i++) await fail(limiter);
    expect(await fail(limiter)).toBe(true);
    expect(await fail(limiter, { ...attempt, ip: "10.0.0.2" })).toBe(false);
    expect(await fail(limiter, { ...attempt, slug: "other" })).toBe(false);
    expect(await fail(limiter, { ...attempt, scope: "check" })).toBe(false);
  });

  test("requests without an IP share one bucket per host", async () => {
    const limiter = pagePasswordRateLimit();
    const noIp = { ...attempt, ip: null };
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES; i++) {
      await fail(limiter, noIp);
    }
    expect(await fail(limiter, noIp)).toBe(true);
    expect(await fail(limiter, attempt)).toBe(false);
  });

  test("bounds the host part of the key", async () => {
    const keys: string[] = [];
    const limiter = pagePasswordRateLimit({
      eval: <TArgs extends unknown[], TData>(
        _script: string,
        k: string[],
        _args: TArgs,
      ) => {
        keys.push(...k);
        return Promise.resolve([1] as TData);
      },
    });
    await limiter.reserve({ ...attempt, slug: "x".repeat(10_000) });
    expect(keys[0]?.length).toBeLessThan(400);
  });

  test("is a no-op when no Redis URL is configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("KV_REST_API_URL", "");
    const limiter = pagePasswordRateLimit();
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES * 2; i++) {
      expect(await fail(limiter)).toBe(false);
    }
  });

  test("fails open when Redis is unavailable, on reserve and on release", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let calls = 0;
    const limiter = pagePasswordRateLimit({
      eval: <TArgs extends unknown[], TData>(
        script: string,
        _keys: string[],
        _args: TArgs,
      ) => {
        calls++;
        // First reserve succeeds, everything after fails.
        return calls === 1 && script === "incrWithTtl"
          ? Promise.resolve([1] as TData)
          : Promise.reject(new Error("down"));
      },
    });
    const slot = await limiter.reserve(attempt);
    expect(slot.locked).toBe(false);
    await expect(slot.release()).resolves.toBeUndefined();
    expect((await limiter.reserve(attempt)).locked).toBe(false);
    expect(calls).toBe(3);
  });

  test("fails open when a refused attempt cannot give its slot back", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const limiter = pagePasswordRateLimit({
      eval: <TArgs extends unknown[], TData>(
        script: string,
        _keys: string[],
        _args: TArgs,
      ) =>
        script === "incrWithTtl"
          ? Promise.resolve([MAX_PAGE_PASSWORD_FAILURES + 1] as TData)
          : Promise.reject(new Error("down")),
    });
    expect((await limiter.reserve(attempt)).locked).toBe(false);
  });

  test("still refuses when the over-limit slot is given back", async () => {
    const limiter = pagePasswordRateLimit({
      eval: <TArgs extends unknown[], TData>(
        script: string,
        _keys: string[],
        _args: TArgs,
      ) =>
        Promise.resolve(
          (script === "incrWithTtl"
            ? [MAX_PAGE_PASSWORD_FAILURES + 1]
            : MAX_PAGE_PASSWORD_FAILURES) as TData,
        ),
    });
    expect((await limiter.reserve(attempt)).locked).toBe(true);
  });
});
