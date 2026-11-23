import { describe, expect, test } from "vitest";

import {
  gatePasswordAttempt,
  type PasswordAttemptLimiter,
} from "./gate-password-attempt";

function fakeLimiter(max = 3) {
  const failures = new Map<string, number>();
  const key = (a: { slug: string; ip: string | null }) => `${a.slug}:${a.ip}`;
  const limiter: PasswordAttemptLimiter = {
    isLocked: async (a) => (failures.get(key(a)) ?? 0) >= max,
    recordFailure: async (a) => {
      failures.set(key(a), (failures.get(key(a)) ?? 0) + 1);
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
        isLocked: async (a) => {
          scopes.push(a.scope);
          return false;
        },
        recordFailure: async (a) => {
          scopes.push(a.scope);
        },
      },
    });
    expect(scopes).toEqual(["login", "login"]);
  });
});
