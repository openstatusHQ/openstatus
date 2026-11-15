import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cachedPipe } from "./tb-cache";

describe("cachedPipe (no Redis)", () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = url;
    vi.useRealTimers();
  });

  it("shares one in-flight read between identical calls", async () => {
    const pipe = vi.fn(async (p: { id: string }) => ({ data: [p.id] }));
    const read = cachedPipe("dedupe", pipe, 60);

    const [a, b] = await Promise.all([read({ id: "1" }), read({ id: "1" })]);

    expect(pipe).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ data: ["1"] });
    expect(b).toBe(a);
  });

  it("keeps distinct params apart", async () => {
    const pipe = vi.fn(async (p: { id: string }) => ({ data: [p.id] }));
    const read = cachedPipe("distinct", pipe, 60);

    await Promise.all([read({ id: "1" }), read({ id: "2" })]);

    expect(pipe).toHaveBeenCalledTimes(2);
  });

  it("starts a fresh read once an in-flight one looks hung", async () => {
    let calls = 0;
    const pipe = vi.fn((_: { id: string }) => {
      calls++;
      return calls === 1
        ? new Promise<{ data: string[] }>(() => {})
        : Promise.resolve({ data: ["fresh"] });
    });
    const read = cachedPipe("hung", pipe, 60);

    void read({ id: "1" });
    vi.advanceTimersByTime(5_000);

    await expect(read({ id: "1" })).resolves.toEqual({ data: ["fresh"] });
    expect(pipe).toHaveBeenCalledTimes(2);
  });

  it("does not keep a failed read around", async () => {
    const pipe = vi
      .fn<(p: { id: string }) => Promise<{ data: string[] }>>()
      .mockRejectedValueOnce(new Error("429"))
      .mockResolvedValueOnce({ data: ["ok"] });
    const read = cachedPipe("failed", pipe, 60);

    await expect(read({ id: "1" })).rejects.toThrow("429");
    await expect(read({ id: "1" })).resolves.toEqual({ data: ["ok"] });
  });
});
