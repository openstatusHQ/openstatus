import { describe, expect, test } from "vitest";

import {
  gatePasswordAttempt,
  type PasswordAttemptLimiter,
} from "./gate-password-attempt";

// Mirrors the Redis limiter: reserve increments first, a refused attempt
// gives its slot straight back, and release gives a slot back.
function fakeLimiter(max = 3) {
  const failures = new Map<string, number>();
  const key = (a: { slug: string; ip: string | null }) => `${a.slug}:${a.ip}`;
  const limiter: PasswordAttemptLimiter = {
    reserve: async (a) => {
      const k = key(a);
      const count = (failures.get(k) ?? 0) + 1;
      failures.set(k, count);
      const release = async () => {
        const left = (failures.get(k) ?? 1) - 1;
        if (left <= 0) failures.delete(k);
        else failures.set(k, left);
      };
      if (count > max) {
        await release();
        return { locked: true, release: async () => {} };
      }
      return { locked: false, release };
    },
  };
  return { limiter, failures };
}

const passwordPage = { accessType: "password" as const, password: "s3cret" };
const base = {
  page: passwordPage,
  host: "acme",
  clientIp: "10.0.0.1",
  queryPassword: null,
  cookiePassword: undefined,
};

describe("gatePasswordAttempt", () => {
  test("leaves a page without a password gate alone", async () => {
    const { limiter, failures } = fakeLimiter();
    const result = await gatePasswordAttempt({
      ...base,
      page: { accessType: "public", password: null },
      queryPassword: "anything",
      limiter,
    });
    expect(result).toEqual({
      queryPassword: "anything",
      cookiePassword: undefined,
      clearCookie: false,
    });
    expect(failures.size).toBe(0);
  });

  test("a request without a password is not a guess", async () => {
    const { limiter, failures } = fakeLimiter();
    await gatePasswordAttempt({ ...base, limiter });
    expect(failures.size).toBe(0);
  });

  test("the right password passes and does not count", async () => {
    const { limiter, failures } = fakeLimiter();
    for (const input of [
      { queryPassword: "s3cret" },
      { cookiePassword: "s3cret" },
    ]) {
      const result = await gatePasswordAttempt({ ...base, ...input, limiter });
      expect(result.clearCookie).toBe(false);
    }
    expect(failures.size).toBe(0);
  });

  test("a wrong query password counts and keeps the cookie", async () => {
    const { limiter, failures } = fakeLimiter();
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
    expect(failures.get("acme:10.0.0.1")).toBe(1);
  });

  test("a wrong cookie counts and is cleared", async () => {
    const { limiter, failures } = fakeLimiter();
    const result = await gatePasswordAttempt({
      ...base,
      cookiePassword: "stale",
      limiter,
    });
    expect(result.clearCookie).toBe(true);
    expect(failures.get("acme:10.0.0.1")).toBe(1);
  });

  test("a wrong query password wins over a valid cookie", async () => {
    const { limiter, failures } = fakeLimiter();
    const result = await gatePasswordAttempt({
      ...base,
      queryPassword: "nope",
      cookiePassword: "s3cret",
      limiter,
    });
    expect(result.clearCookie).toBe(true);
    expect(failures.get("acme:10.0.0.1")).toBe(1);
  });

  test("once locked, every presented password is dropped, the right one too", async () => {
    const { limiter, failures } = fakeLimiter(3);
    for (let i = 0; i < 3; i++) {
      await gatePasswordAttempt({ ...base, queryPassword: "nope", limiter });
    }
    const result = await gatePasswordAttempt({
      ...base,
      queryPassword: "s3cret",
      cookiePassword: "s3cret",
      limiter,
    });
    expect(result).toEqual({
      queryPassword: null,
      cookiePassword: undefined,
      clearCookie: false,
    });
    // A locked request is not counted again.
    expect(failures.get("acme:10.0.0.1")).toBe(3);
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

  test("uses the login scope, shared with the login form", async () => {
    const scopes: string[] = [];
    await gatePasswordAttempt({
      ...base,
      queryPassword: "nope",
      limiter: {
        reserve: async (a) => {
          scopes.push(a.scope);
          return { locked: false, release: async () => {} };
        },
      },
    });
    expect(scopes).toEqual(["login"]);
  });

  test("a parallel burst of wrong passwords cannot pass the cap", async () => {
    const { limiter, failures } = fakeLimiter(3);
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        gatePasswordAttempt({ ...base, queryPassword: "nope", limiter }),
      ),
    );
    // Only the first three reach the password check; the rest are refused.
    expect(results.filter((r) => r.queryPassword === "nope")).toHaveLength(3);
    expect(failures.get("acme:10.0.0.1")).toBe(3);
  });

  test("a right password gives its slot back", async () => {
    const { limiter, failures } = fakeLimiter(3);
    await gatePasswordAttempt({ ...base, queryPassword: "nope", limiter });
    await gatePasswordAttempt({ ...base, cookiePassword: "s3cret", limiter });
    expect(failures.get("acme:10.0.0.1")).toBe(1);
  });
});
