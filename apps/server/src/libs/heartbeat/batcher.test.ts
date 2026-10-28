import { describe, expect, test } from "vitest";

import { Batcher } from "./batcher";

const options = {
  maxBatchSize: 3,
  flushIntervalMs: 60_000,
  retryBudgetMs: 1_000,
  maxBufferSize: 5,
};
const instant = () => Promise.resolve();

describe("Batcher", () => {
  test("sends full batches immediately and the rest on flush", async () => {
    const sent: number[][] = [];
    const batcher = new Batcher<number>(
      async (events) => {
        sent.push(events);
      },
      options,
      instant,
    );

    for (const n of [1, 2, 3, 4]) batcher.add(n);
    await batcher.flush();

    expect(sent).toEqual([[1, 2, 3], [4]]);
  });

  test("retries a failing batch until it goes through", async () => {
    let calls = 0;
    const batcher = new Batcher<number>(
      async () => {
        calls++;
        if (calls < 3) throw new Error("429");
      },
      options,
      instant,
    );

    batcher.add(1);
    await batcher.flush();

    expect(calls).toBe(3);
  });

  test("drops a batch once the retry budget is spent", async () => {
    let calls = 0;
    const batcher = new Batcher<number>(
      async () => {
        calls++;
        throw new Error("down");
      },
      options,
      instant,
    );

    batcher.add(1);
    await batcher.flush();

    // 250 + 500 fit in 1 s, the third backoff (1 s) does not
    expect(calls).toBe(3);
  });

  test("drops events past the buffer cap", async () => {
    const sent: number[] = [];
    const batcher = new Batcher<number>(
      async (events) => {
        sent.push(...events);
      },
      { ...options, maxBatchSize: 100 },
      instant,
    );

    for (let n = 0; n < 8; n++) batcher.add(n);
    await batcher.flush();

    expect(sent).toEqual([0, 1, 2, 3, 4]);
  });
});
