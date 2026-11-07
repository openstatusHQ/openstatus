import { describe, expect, test } from "vitest";

import { drainBackground, runInBackground } from "./background";

const after = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("drainBackground", () => {
  test("waits for a running task to settle", async () => {
    let done = false;
    runInBackground(
      "ok",
      after(20).then(() => (done = true)),
    );
    await drainBackground(1_000);
    expect(done).toBe(true);
  });

  test("gives up after the grace period", async () => {
    let done = false;
    runInBackground(
      "slow",
      after(200).then(() => (done = true)),
    );
    await drainBackground(10);
    expect(done).toBe(false);
    await after(200);
  });
});

describe("runInBackground", () => {
  test("a rejected task reaches onDefect and does not block the drain", async () => {
    let defects = 0;
    runInBackground(
      "crash",
      after(5).then(() => Promise.reject(new Error("boom"))),
      () => defects++,
    );
    await expect(drainBackground(1_000)).resolves.toBeUndefined();
    await after(0);
    expect(defects).toBe(1);
  });
});
