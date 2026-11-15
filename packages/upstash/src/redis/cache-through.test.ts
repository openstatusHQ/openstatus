import { describe, expect, it, vi } from "vitest";

import { cacheThrough } from "./cache-through";

function fakeRedis(store = new Map<string, unknown>()) {
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
      return "OK";
    }),
  };
}

describe("cacheThrough", () => {
  it("loads on a miss and stores the result with the ttl", async () => {
    const redis = fakeRedis();
    const load = vi.fn(async () => ({ data: [1] }));

    const value = await cacheThrough(redis as never, "k", 60, load);

    expect(value).toEqual({ data: [1] });
    expect(load).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith("k", { data: [1] }, { ex: 60 });
  });

  it("returns the cached value without loading on a hit", async () => {
    const redis = fakeRedis(new Map([["k", { data: [2] }]]));
    const load = vi.fn(async () => ({ data: [1] }));

    const value = await cacheThrough(redis as never, "k", 60, load);

    expect(value).toEqual({ data: [2] });
    expect(load).not.toHaveBeenCalled();
  });

  it("falls through to load when redis fails", async () => {
    const redis = {
      get: vi.fn(async () => {
        throw new Error("down");
      }),
      set: vi.fn(async () => {
        throw new Error("down");
      }),
    };
    const load = vi.fn(async () => "fresh");

    await expect(cacheThrough(redis as never, "k", 60, load)).resolves.toBe(
      "fresh",
    );
  });

  it("falls through to load when redis is slow", async () => {
    const redis = {
      get: vi.fn(() => new Promise(() => {})),
      set: vi.fn(() => new Promise(() => {})),
    };
    const load = vi.fn(async () => "fresh");

    await expect(
      cacheThrough(redis as never, "k", 60, load, { timeoutMs: 10 }),
    ).resolves.toBe("fresh");
  });

  it("does not cache a failed load", async () => {
    const redis = fakeRedis();
    const load = vi.fn(async () => {
      throw new Error("tinybird 429");
    });

    await expect(cacheThrough(redis as never, "k", 60, load)).rejects.toThrow(
      "tinybird 429",
    );
    expect(redis.set).not.toHaveBeenCalled();
  });
});
