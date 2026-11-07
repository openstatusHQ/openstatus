import { describe, expect, test } from "vitest";

import { drainBackground, runInBackground } from "./background";

const after = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("drainBackground", () => {
  test("waits for a running task to settle", async () => {
    let done = false;
    runInBackground(after(20).then(() => (done = true)));
    await drainBackground(1_000);
    expect(done).toBe(true);
  });

  test("gives up after the grace period", async () => {
    let done = false;
    runInBackground(after(200).then(() => (done = true)));
    await drainBackground(10);
    expect(done).toBe(false);
    await after(200);
  });

  test("a rejected task neither throws nor blocks the drain", async () => {
    runInBackground(Promise.reject(new Error("boom")).catch(() => {}));
    runInBackground(after(5).then(() => Promise.reject(new Error("late"))));
    await expect(drainBackground(1_000)).resolves.toBeUndefined();
  });
});
