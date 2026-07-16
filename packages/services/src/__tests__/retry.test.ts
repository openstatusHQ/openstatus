import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { NotFoundError } from "../errors";
import {
  isRetryableDbError,
  isTransientServerError,
  retryRead,
  withBusyRetry,
} from "../retry";

const transient502 = () => {
  const err = new Error("Failed query: select ...");
  (err as Error & { cause: unknown }).cause = {
    code: "SERVER_ERROR",
    status: 502,
    message: "SERVER_ERROR: Server returned HTTP status 502",
  };
  return err;
};

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

  test("terminates on a self-referential cause cycle", () => {
    const err: { code?: string; cause?: unknown } = {};
    err.cause = err;
    expect(isRetryableDbError(err)).toBe(false);
  });

  test("finds a retryable code at the deepest searched level", () => {
    // wrapped 9 times -> code sits at depth 9, the last level inspected.
    let chain: { code?: string; cause?: unknown } = { code: "SQLITE_BUSY" };
    for (let i = 0; i < 9; i++) chain = { cause: chain };
    expect(isRetryableDbError(chain)).toBe(true);
  });

  test("stops at MAX_CAUSE_DEPTH (code one level too deep is unreachable)", () => {
    // wrapped 10 times -> code sits at depth 10, never inspected.
    let chain: { code?: string; cause?: unknown } = { code: "SQLITE_BUSY" };
    for (let i = 0; i < 10; i++) chain = { cause: chain };
    expect(isRetryableDbError(chain)).toBe(false);
  });
});

describe("isTransientServerError", () => {
  test("true for a 5xx status (HttpServerError cause)", () => {
    expect(isTransientServerError({ code: "SERVER_ERROR", status: 502 })).toBe(
      true,
    );
  });

  test("true for a 5xx message without a status", () => {
    expect(
      isTransientServerError(new Error("Server returned HTTP status 503")),
    ).toBe(true);
  });

  test("true for the drizzle-wrapped 5xx cause chain", () => {
    const err = new Error("Failed query: select ...");
    (err as Error & { cause: unknown }).cause = {
      code: "SERVER_ERROR",
      status: 502,
      message: "SERVER_ERROR: Server returned HTTP status 502",
    };
    expect(isTransientServerError(err)).toBe(true);
  });

  test("false for a non-transient 4xx SERVER_ERROR", () => {
    expect(
      isTransientServerError({
        code: "SERVER_ERROR",
        status: 404,
        message: "Server returned HTTP status 404",
      }),
    ).toBe(false);
  });

  test("false for a bare SERVER_ERROR with no 5xx signal", () => {
    expect(isTransientServerError({ code: "SERVER_ERROR" })).toBe(false);
  });

  test("false for a busy/locked error (handled by isRetryableDbError)", () => {
    expect(isTransientServerError({ code: "SQLITE_BUSY" })).toBe(false);
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

  test("honours a custom predicate (e.g. transient 5xx for reads)", async () => {
    let attempts = 0;
    const result = await withBusyRetry(
      async () => {
        attempts++;
        if (attempts < 2) throw { code: "SERVER_ERROR", status: 503 };
        return "ok";
      },
      (e) => isRetryableDbError(e) || isTransientServerError(e),
    );
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });

  test("default predicate does not retry a transient 5xx", async () => {
    let attempts = 0;
    const original = { code: "SERVER_ERROR", status: 503 };
    const promise = withBusyRetry(async () => {
      attempts++;
      throw original;
    });
    await expect(promise).rejects.toBe(original);
    expect(attempts).toBe(1);
  });
});

describe("retryRead", () => {
  test("retries a drizzle-wrapped transient 502 then resolves", async () => {
    let attempts = 0;
    const result = await retryRead(async () => {
      attempts++;
      if (attempts < 3) throw transient502();
      return "ok";
    });
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  test("retries SQLITE_BUSY", async () => {
    let attempts = 0;
    const result = await retryRead(async () => {
      attempts++;
      if (attempts < 2) throw { code: "SQLITE_BUSY" };
      return "ok";
    });
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });

  test("does not retry a 4xx server error", async () => {
    let attempts = 0;
    const original = {
      code: "SERVER_ERROR",
      status: 404,
      message: "Server returned HTTP status 404",
    };
    const promise = retryRead(async () => {
      attempts++;
      throw original;
    });
    await expect(promise).rejects.toBe(original);
    expect(attempts).toBe(1);
  });

  test("gives up after 5 attempts on a sustained 5xx", async () => {
    let attempts = 0;
    const original = {
      code: "SERVER_ERROR",
      status: 503,
      message: "Server returned HTTP status 503",
    };
    const promise = retryRead(async () => {
      attempts++;
      throw original;
    });
    await expect(promise).rejects.toBe(original);
    expect(attempts).toBe(5);
  });
});
