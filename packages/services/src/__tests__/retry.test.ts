import { describe, expect, test } from "bun:test";

import { NotFoundError } from "../errors";
import { isRetryableDbError, withBusyRetry } from "../retry";

describe("isRetryableDbError", () => {
  test("true for SQLITE_BUSY code", () => {
    expect(isRetryableDbError({ code: "SQLITE_BUSY" })).toBe(true);
  });

  test("true for SQLITE_LOCKED code", () => {
    expect(isRetryableDbError({ code: "SQLITE_LOCKED" })).toBe(true);
  });

  test("true for nested cause carrying the code", () => {
    const err = new Error("Failed query");
    (err as Error & { cause: unknown }).cause = { code: "SQLITE_BUSY" };
    expect(isRetryableDbError(err)).toBe(true);
  });

  test("true for message-only match without a code", () => {
    expect(
      isRetryableDbError(new Error("SQLite error: database is locked")),
    ).toBe(true);
  });

  test("false for an unrelated error", () => {
    expect(isRetryableDbError(new Error("nope"))).toBe(false);
  });

  test("false for a NotFoundError", () => {
    expect(isRetryableDbError(new NotFoundError("page", 1))).toBe(false);
  });

  test("false for non-object values", () => {
    expect(isRetryableDbError(null)).toBe(false);
    expect(isRetryableDbError("SQLITE_BUSY")).toBe(false);
  });
});

describe("withBusyRetry", () => {
  test("resolves once a transient busy error clears", async () => {
    let attempts = 0;
    const result = await withBusyRetry(async () => {
      attempts++;
      if (attempts < 3) throw { code: "SQLITE_BUSY" };
      return "ok";
    });
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  test("gives up after 5 attempts and rethrows the original error", async () => {
    let attempts = 0;
    const original = { code: "SQLITE_BUSY", marker: Symbol("x") };
    const promise = withBusyRetry(async () => {
      attempts++;
      throw original;
    });
    await expect(promise).rejects.toBe(original);
    expect(attempts).toBe(5);
  });

  test("does not retry a non-retryable error", async () => {
    let attempts = 0;
    const original = new NotFoundError("page", 1);
    const promise = withBusyRetry(async () => {
      attempts++;
      throw original;
    });
    await expect(promise).rejects.toBe(original);
    expect(attempts).toBe(1);
  });
});
