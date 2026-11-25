import { describe, expect, test } from "vitest";

import { ForbiddenError, UnauthorizedError } from "../errors";
import { pageAccessCookieKey } from "./cookie-key";
import {
  checkPageAccess,
  type PageVisitor,
  type PasswordAttemptLimiter,
  requirePageAccess,
} from "./resolve-page-access";

type Row = Parameters<typeof checkPageAccess>[0];

const passwordPage: Row = {
  slug: "acme",
  accessType: "password",
  password: "s3cret",
  authEmailDomains: null,
  allowedIpRanges: null,
};

// Mirrors the Redis limiter: distinct wrong values per page and IP, a right
// password only reads the lock.
function fakeLimiter(max = 3) {
  const failures = new Map<string, Set<string>>();
  const calls: { kind: string; slug: string; ip: string | null }[] = [];
  const bucket = (a: { slug: string; ip: string | null }) =>
    `${a.slug}:${a.ip}`;
  const limiter: PasswordAttemptLimiter = {
    isLocked: async (attempt) => {
      calls.push({ kind: "isLocked", ...attempt });
      return (failures.get(bucket(attempt))?.size ?? 0) >= max;
    },
    recordFailure: async (attempt, password) => {
      calls.push({ kind: "recordFailure", ...attempt });
      const set = failures.get(bucket(attempt)) ?? new Set<string>();
      set.add(password);
      failures.set(bucket(attempt), set);
    },
  };
  const kept = (slug = "acme", ip: string | null = "10.0.0.1") =>
    failures.get(`${slug}:${ip}`)?.size ?? 0;
  return { limiter, calls, kept };
}

const visitor = (
  limiter: PasswordAttemptLimiter | undefined,
  extra: Partial<PageVisitor> = {},
): PageVisitor => ({
  clientIp: "10.0.0.1",
  passwordAttempts: limiter,
  ...extra,
});

describe("checkPageAccess", () => {
  test("without a limiter it is resolvePageAccess", async () => {
    expect(
      await checkPageAccess(
        passwordPage,
        visitor(undefined, { queryPassword: "s3cret" }),
      ),
    ).toEqual({ ok: true });
    expect(
      (
        await checkPageAccess(
          passwordPage,
          visitor(undefined, { queryPassword: "nope" }),
        )
      ).ok,
    ).toBe(false);
  });

  test("a page without a password gate never reserves", async () => {
    const { limiter, calls } = fakeLimiter();
    const gate = await checkPageAccess(
      { ...passwordPage, accessType: "public" },
      visitor(limiter, { queryPassword: "anything" }),
    );
    expect(gate.ok).toBe(true);
    expect(calls).toEqual([]);
  });

  test("no password, or an empty one, is not a guess", async () => {
    const { limiter, calls } = fakeLimiter();
    for (const extra of [{}, { queryPassword: "" }, { getCookie: () => "" }]) {
      const gate = await checkPageAccess(passwordPage, visitor(limiter, extra));
      expect(gate).toMatchObject({ ok: false, status: 401 });
    }
    expect(calls).toEqual([]);
  });

  test("the right password passes and only reads the lock", async () => {
    const { limiter, kept } = fakeLimiter();
    for (let i = 0; i < 5; i++) {
      expect(
        await checkPageAccess(
          passwordPage,
          visitor(limiter, { queryPassword: "s3cret" }),
        ),
      ).toEqual({ ok: true });
    }
    expect(kept()).toBe(0);
  });

  test("a wrong password is recorded", async () => {
    const { limiter, kept } = fakeLimiter();
    const gate = await checkPageAccess(
      passwordPage,
      visitor(limiter, { queryPassword: "nope" }),
    );
    expect(gate).toMatchObject({ ok: false, status: 401 });
    expect(kept()).toBe(1);
  });

  test("once locked, the right password is refused too", async () => {
    const { limiter } = fakeLimiter(3);
    for (let i = 0; i < 3; i++) {
      await checkPageAccess(
        passwordPage,
        visitor(limiter, { queryPassword: `nope-${i}` }),
      );
    }
    expect(
      await checkPageAccess(
        passwordPage,
        visitor(limiter, { queryPassword: "s3cret" }),
      ),
    ).toMatchObject({ ok: false, status: 401 });
  });

  test("keys on the page slug and the visitor's IP", async () => {
    const { limiter, calls } = fakeLimiter();
    await checkPageAccess(
      { ...passwordPage, slug: "acme-status" },
      visitor(limiter, { queryPassword: "nope", clientIp: null }),
    );
    expect(calls).toEqual([
      { kind: "recordFailure", slug: "acme-status", ip: null },
    ]);
  });

  test("reads the cookie keyed on the page slug", async () => {
    const { limiter, kept } = fakeLimiter();
    const gate = await checkPageAccess(
      passwordPage,
      visitor(limiter, {
        getCookie: (name) =>
          name === pageAccessCookieKey("acme") ? "s3cret" : undefined,
      }),
    );
    expect(gate.ok).toBe(true);
    expect(kept()).toBe(0);
  });

  test("a parallel burst of distinct wrong passwords locks the page", async () => {
    const { limiter, kept } = fakeLimiter(3);
    const gates = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        checkPageAccess(
          passwordPage,
          visitor(limiter, { queryPassword: `burst-${i}` }),
        ),
      ),
    );
    expect(gates.every((g) => !g.ok)).toBe(true);
    expect(kept()).toBe(20);
    expect(
      await checkPageAccess(
        passwordPage,
        visitor(limiter, { queryPassword: "s3cret" }),
      ),
    ).toMatchObject({ ok: false, status: 401 });
  });

  test("other gates are not rate-limited", async () => {
    const { limiter, calls } = fakeLimiter();
    const gate = await checkPageAccess(
      {
        ...passwordPage,
        accessType: "email-domain",
        authEmailDomains: "acme.com",
      },
      visitor(limiter, { email: "a@evil.com", queryPassword: "x" }),
    );
    expect(gate).toMatchObject({ ok: false, status: 403 });
    expect(calls).toEqual([]);
  });
});

describe("requirePageAccess", () => {
  test("throws UnauthorizedError when locked and passes the right password otherwise", async () => {
    const { limiter } = fakeLimiter(1);
    await expect(
      requirePageAccess(
        passwordPage,
        visitor(limiter, { queryPassword: "s3cret" }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      requirePageAccess(
        passwordPage,
        visitor(limiter, { queryPassword: "nope" }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(
      requirePageAccess(
        passwordPage,
        visitor(limiter, { queryPassword: "s3cret" }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test("throws ForbiddenError for a denied IP", async () => {
    await expect(
      requirePageAccess(
        {
          ...passwordPage,
          accessType: "ip-restriction",
          allowedIpRanges: "10.0.0.0/8",
        },
        { clientIp: "192.168.0.1" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
