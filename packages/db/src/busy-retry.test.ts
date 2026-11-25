import { describe, expect, test } from "vitest";

import { isBusyError, withBusyRetry, withBusyRetryClient } from "./busy-retry";

const busyError = () =>
  Object.assign(new Error("Failed query: insert into monitor"), {
    cause: Object.assign(new Error("SQLite error: database is locked"), {
      code: "SQLITE_BUSY",
    }),
  });

describe("withBusyRetry", () => {
  test("retries a statement that lost the write lock", async () => {
    let attempts = 0;
    const row = await withBusyRetry(async () => {
      attempts++;
      if (attempts < 3) throw busyError();
      return { id: 42 };
    });

    expect(row).toEqual({ id: 42 });
    expect(attempts).toBe(3);
  });

  test("rethrows a non-busy error without retrying", async () => {
    let attempts = 0;

    await expect(
      withBusyRetry(async () => {
        attempts++;
        throw new Error("UNIQUE constraint failed: monitor.name");
      }),
    ).rejects.toThrow("UNIQUE constraint failed");

    expect(attempts).toBe(1);
  });

  test("gives up after the last attempt and rethrows the busy error", async () => {
    let attempts = 0;
    const error = busyError();

    await expect(
      withBusyRetry(async () => {
        attempts++;
        throw error;
      }),
    ).rejects.toBe(error);

    expect(attempts).toBe(5);
  });
});

describe("isBusyError", () => {
  test("finds the code on a wrapped cause", () => {
    expect(isBusyError(busyError())).toBe(true);
    expect(isBusyError(new Error("SQLite error: database is locked"))).toBe(
      true,
    );
    expect(isBusyError(new Error("connection refused"))).toBe(false);
    expect(isBusyError(null)).toBe(false);
  });
});

const fakeClient = () => {
  let calls = 0;
  const busyUntil = (succeedAt: number) => async () => {
    calls++;
    if (calls < succeedAt) throw busyError();
    return { rows: [] };
  };
  return {
    calls: () => calls,
    client: (succeedAt: number) =>
      ({
        closed: false,
        protocol: "http",
        execute: busyUntil(succeedAt),
        batch: busyUntil(succeedAt),
        executeMultiple: async () => {},
        transaction: async () => ({ execute: busyUntil(succeedAt + 1) }),
        close: () => {},
      }) as unknown as Parameters<typeof withBusyRetryClient>[0],
  };
};

describe("withBusyRetryClient", () => {
  test("retries a top-level statement that lost the write lock", async () => {
    const fake = fakeClient();
    const client = withBusyRetryClient(fake.client(3));

    await client.execute("insert into monitor (name) values ('a')");

    expect(fake.calls()).toBe(3);
  });

  test("does not replay a batch whose earlier statements applied", async () => {
    const fake = fakeClient();
    const client = withBusyRetryClient(fake.client(2));

    const error = await client
      .batch(["insert into monitor (name) values ('a')"])
      .catch((err: unknown) => err);

    expect(isBusyError(error)).toBe(true);
    expect(fake.calls()).toBe(1);
  });

  test("does not retry a statement inside a transaction", async () => {
    const fake = fakeClient();
    const client = withBusyRetryClient(fake.client(1));
    const tx = await client.transaction("write");

    const error = await tx
      .execute("insert into monitor (name) values ('a')")
      .catch((err: unknown) => err);

    expect(isBusyError(error)).toBe(true);
    expect(fake.calls()).toBe(1);
  });
});
