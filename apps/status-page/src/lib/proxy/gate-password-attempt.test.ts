import { describe, expect, test } from "vitest";

import {
  gatePasswordAttempt,
  type PasswordAttemptLimiter,
} from "./gate-password-attempt";

// Mirrors the Redis limiter: distinct wrong values per page and IP, a right
// password only reads the lock.
function fakeLimiter(max = 3) {
  const failures = new Map<string, Set<string>>();
  const calls: { kind: string; slug: string; value?: string }[] = [];
  const key = (a: { slug: string; ip: string | null }) => `${a.slug}:${a.ip}`;
  const limiter: PasswordAttemptLimiter = {
    isLocked: async (a) => {
      calls.push({ kind: "isLocked", slug: a.slug });
      return (failures.get(key(a))?.size ?? 0) >= max;
    },
    recordFailure: async (a, password) => {
      calls.push({ kind: "recordFailure", slug: a.slug, value: password });
      const set = failures.get(key(a)) ?? new Set<string>();
      set.add(password);
      failures.set(key(a), set);
    },
  };
  const count = (ip = "10.0.0.1") => failures.get(`acme:${ip}`)?.size ?? 0;
  return { limiter, calls, count };
}

const passwordPage = {
  accessType: "password" as const,
  password: "s3cret",
  slug: "acme",
};
const base = {
  page: passwordPage,
  clientIp: "10.0.0.1",
  queryPassword: null,
  cookiePassword: undefined,
};
const dropped = {
  queryPassword: null,
  cookiePassword: undefined,
  clearCookie: false,
};

describe("gatePasswordAttempt", () => {
  test("leaves a page without a password gate alone", async () => {
    const { limiter, calls } = fakeLimiter();
    const result = await gatePasswordAttempt({
      ...base,
      page: { accessType: "public", password: null, slug: "acme" },
      queryPassword: "anything",
      limiter,
    });
    expect(result).toEqual({
      queryPassword: "anything",
      cookiePassword: undefined,
      clearCookie: false,
    });
    expect(calls).toEqual([]);
  });

  test("no password, or an empty one, is not a guess", async () => {
    const { limiter, calls } = fakeLimiter();
    await gatePasswordAttempt({ ...base, limiter });
    await gatePasswordAttempt({
      ...base,
      queryPassword: "",
      cookiePassword: "",
      limiter,
    });
    // An empty ?pw= wins over a cookie and can never authorize.
    await gatePasswordAttempt({
      ...base,
      queryPassword: "",
      cookiePassword: "s3cret",
      limiter,
    });
    expect(calls).toEqual([]);
  });

  test("the right password passes and only reads the lock", async () => {
    const { limiter, calls, count } = fakeLimiter();
    for (const input of [
      { queryPassword: "s3cret" },
      { cookiePassword: "s3cret" },
    ]) {
      const result = await gatePasswordAttempt({ ...base, ...input, limiter });
      expect(result.clearCookie).toBe(false);
    }
    expect(calls.map((c) => c.kind)).toEqual(["isLocked", "isLocked"]);
    expect(count()).toBe(0);
  });

  test("a wrong query password counts and keeps the cookie", async () => {
    const { limiter, count } = fakeLimiter();
    const result = await gatePasswordAttempt({
      ...base,
      queryPassword: "nope",
      limiter,
    });
    expect(result).toEqual({
      queryPassword: "nope",
      cookiePassword: undefined,
      clearCookie: false,
    });
    expect(count()).toBe(1);
  });

  test("a wrong cookie counts and is cleared", async () => {
    const { limiter, count } = fakeLimiter();
    const result = await gatePasswordAttempt({
      ...base,
      cookiePassword: "stale",
      limiter,
    });
    expect(result.clearCookie).toBe(true);
    expect(count()).toBe(1);
  });

  test("a wrong query password wins over a valid cookie, and it is what counts", async () => {
    const { limiter, calls } = fakeLimiter();
    const result = await gatePasswordAttempt({
      ...base,
      queryPassword: "nope",
      cookiePassword: "s3cret",
      limiter,
    });
    expect(result.clearCookie).toBe(true);
    expect(calls).toEqual([
      { kind: "recordFailure", slug: "acme", value: "nope" },
    ]);
  });

  test("the same stale cookie on every request counts once", async () => {
    const { limiter, count } = fakeLimiter(3);
    for (let i = 0; i < 10; i++) {
      await gatePasswordAttempt({ ...base, cookiePassword: "stale", limiter });
    }
    expect(count()).toBe(1);
    expect(
      (await gatePasswordAttempt({ ...base, queryPassword: "s3cret", limiter }))
        .queryPassword,
    ).toBe("s3cret");
  });

  test("once locked, the right password is dropped too", async () => {
    const { limiter } = fakeLimiter(3);
    for (let i = 0; i < 3; i++) {
      await gatePasswordAttempt({
        ...base,
        queryPassword: `nope-${i}`,
        limiter,
      });
    }
    expect(
      await gatePasswordAttempt({
        ...base,
        queryPassword: "s3cret",
        cookiePassword: "s3cret",
        limiter,
      }),
    ).toEqual(dropped);
  });

  test("a lock on one IP leaves another IP alone", async () => {
    const { limiter } = fakeLimiter(1);
    await gatePasswordAttempt({ ...base, queryPassword: "nope", limiter });
    const result = await gatePasswordAttempt({
      ...base,
      clientIp: "10.0.0.2",
      queryPassword: "s3cret",
      limiter,
    });
    expect(result.queryPassword).toBe("s3cret");
  });

  test("keys on the page slug, as the login form does", async () => {
    const { limiter, calls } = fakeLimiter();
    await gatePasswordAttempt({
      ...base,
      page: { ...passwordPage, slug: "acme-status" },
      queryPassword: "nope",
      limiter,
    });
    expect(calls).toEqual([
      { kind: "recordFailure", slug: "acme-status", value: "nope" },
    ]);
  });

  test("a parallel burst of distinct wrong passwords locks the page", async () => {
    const { limiter, count } = fakeLimiter(3);
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        gatePasswordAttempt({ ...base, queryPassword: `burst-${i}`, limiter }),
      ),
    );
    expect(count()).toBe(20);
    expect(
      await gatePasswordAttempt({ ...base, queryPassword: "s3cret", limiter }),
    ).toEqual(dropped);
  });

  test("many concurrent visitors with the right cookie never lock each other out", async () => {
    const { limiter, count } = fakeLimiter(3);
    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        gatePasswordAttempt({ ...base, cookiePassword: "s3cret", limiter }),
      ),
    );
    expect(results.every((r) => r.cookiePassword === "s3cret")).toBe(true);
    expect(count()).toBe(0);
  });
});
