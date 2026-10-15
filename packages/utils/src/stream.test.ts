import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { iteratorToStream, yieldMany } from "./stream";

function delay<T>(ms: number, value: T) {
  return new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
}

async function collect<T>(gen: AsyncGenerator<T>) {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

describe("yieldMany", () => {
  it("yields values in settle order, not input order", async () => {
    const out = await collect(
      yieldMany([delay(30, "slow"), delay(0, "fast"), delay(15, "mid")]),
    );
    expect(out).toEqual(["fast", "mid", "slow"]);
  });

  it("keeps every value that settles in the same microtask batch", async () => {
    const out = await collect(
      yieldMany([1, 2, 3, 4, 5].map((n) => Promise.resolve(n))),
    );
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("completes immediately for an empty list", async () => {
    expect(await collect(yieldMany([]))).toEqual([]);
  });

  it("returns 'done' when exhausted", async () => {
    const gen = yieldMany([Promise.resolve(1)]);
    expect(await gen.next()).toEqual({ value: 1, done: false });
    expect(await gen.next()).toEqual({ value: "done", done: true });
  });

  it("yields values settled before a rejection, then throws it", async () => {
    const out: string[] = [];
    const run = async () => {
      for await (const v of yieldMany([
        delay(0, "a"),
        delay(10, "unused").then(() => Promise.reject(new Error("boom"))),
      ])) {
        out.push(v);
      }
    };
    await expect(run()).rejects.toThrow("boom");
    expect(out).toEqual(["a"]);
  });

  it("surfaces only the first of simultaneous rejections", async () => {
    const gen = yieldMany([
      Promise.reject(new Error("first")),
      Promise.reject(new Error("second")),
    ]);
    await expect(gen.next()).rejects.toThrow("first");
  });
});

describe("iteratorToStream", () => {
  it("enqueues every yielded value then closes", async () => {
    async function* gen() {
      yield "a";
      yield "b";
    }
    const chunks: unknown[] = [];
    for await (const chunk of iteratorToStream(gen())) chunks.push(chunk);
    expect(chunks).toEqual(["a", "b"]);
  });

  it("errors the stream when the iterator throws", async () => {
    async function* gen() {
      yield "a";
      throw new Error("broken");
    }
    const reader = iteratorToStream(gen()).getReader();
    const originalError = console.error;
    console.error = () => {};
    try {
      expect(await reader.read()).toEqual({ value: "a", done: false });
      await expect(reader.read()).rejects.toThrow("broken");
    } finally {
      console.error = originalError;
    }
  });
});
