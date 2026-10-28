import { Duration, Effect, Schedule } from "effect";
import { describe, expect, test } from "vitest";

import { Batcher, retrySchedule } from "./batcher";

const options = {
  maxBatchSize: 3,
  flushIntervalMs: 60_000,
  retryBudgetMs: 1_000,
  maxBufferSize: 5,
};
// no backoff delay, give up after the 3rd attempt
const instant = Schedule.recurs(2);

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

  test("drops a batch once retries are exhausted", async () => {
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

    expect(calls).toBe(3);
  });

  test("default schedule backs off exponentially and caps at 8 s", async () => {
    const delays = await Effect.runPromise(
      Schedule.toStep(retrySchedule(60_000)).pipe(
        Effect.flatMap((step) =>
          Effect.forEach(Array.from({ length: 7 }), () =>
            step(0, undefined).pipe(
              Effect.map(([, d]) => Duration.toMillis(d)),
            ),
          ),
        ),
      ),
    );
    // jittered between 80% and 120% of 250, 500, ... then capped
    const base = [250, 500, 1_000, 2_000, 4_000, 8_000, 8_000];
    delays.forEach((d, i) => {
      expect(d).toBeGreaterThanOrEqual(base[i] * 0.8);
      expect(d).toBeLessThanOrEqual(Math.min(base[i] * 1.2, 8_000));
    });
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
