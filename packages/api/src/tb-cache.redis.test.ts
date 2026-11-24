import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const set = vi.fn(async (key: string, value: unknown, _opts: unknown) => {
  store.set(key, JSON.stringify(value));
  return "OK";
});

// Round-trips through JSON like the real Upstash client.
vi.mock("@openstatus/upstash", async () => {
  const { cacheThrough } =
    await import("@openstatus/upstash/src/redis/cache-through");
  return {
    cacheThrough,
    redis: {
      get: async (key: string) => {
        const raw = store.get(key);
        return raw === undefined ? null : JSON.parse(raw);
      },
      set,
    },
  };
});

const { cachedPipe } = await import("./tb-cache");

describe("cachedPipe (Redis)", () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;

  afterEach(() => {
    if (url === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = url;
  });

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "http://redis.test";
    store.clear();
    set.mockClear();
  });

  it("serves a later call from Redis without running the pipe", async () => {
    const pipe = vi.fn(async (p: { monitorIds: string[] }) => ({
      data: p.monitorIds,
    }));
    const read = cachedPipe("redis-hit", pipe, 120);

    const miss = await read({ monitorIds: ["1", "2"] });
    const hit = await read({ monitorIds: ["1", "2"] });

    expect(pipe).toHaveBeenCalledTimes(1);
    expect(hit).toEqual(miss);
    const [key, , opts] = set.mock.calls[0];
    expect(key).toContain("redis-hit");
    expect(key).toContain('["1","2"]');
    expect(opts).toEqual({ ex: 120 });
  });

  it("keeps Date values on a hit", async () => {
    const interval = new Date("2026-11-16T00:00:00.000Z");
    const pipe = vi.fn(async (_: { id: string }) => ({
      data: [{ interval, success: 1 }],
    }));
    const read = cachedPipe("redis-date", pipe, 60);

    await read({ id: "1" });
    const hit = await read({ id: "1" });

    expect(pipe).toHaveBeenCalledTimes(1);
    expect(hit.data[0].interval).toBeInstanceOf(Date);
    expect(hit.data[0].interval.getTime()).toBe(interval.getTime());
  });
});
