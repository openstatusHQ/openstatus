import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { composeEventHandlers, composeRefs } from "./composition";

describe("composeEventHandlers", () => {
  test("runs the original handler before ours", () => {
    const calls: string[] = [];
    const handler = composeEventHandlers(
      () => calls.push("original"),
      () => calls.push("ours"),
    );
    handler({ defaultPrevented: false });
    expect(calls).toEqual(["original", "ours"]);
  });

  test("skips ours when the original prevents default", () => {
    const calls: string[] = [];
    const handler = composeEventHandlers<{ defaultPrevented: boolean }>(
      (e) => {
        e.defaultPrevented = true;
      },
      () => calls.push("ours"),
    );
    handler({ defaultPrevented: false });
    expect(calls).toEqual([]);
  });

  test("runs ours anyway when the check is disabled", () => {
    const calls: string[] = [];
    const handler = composeEventHandlers(undefined, () => calls.push("ours"), {
      checkForDefaultPrevented: false,
    });
    handler({ defaultPrevented: true });
    expect(calls).toEqual(["ours"]);
  });
});

describe("composeRefs", () => {
  test("sets object refs and calls callback refs", () => {
    const objectRef = { current: null as string | null };
    let callbackValue: string | null = null;
    composeRefs<string>(
      objectRef,
      (v) => {
        callbackValue = v;
      },
      undefined,
    )("node");
    expect(objectRef.current).toBe("node");
    expect(callbackValue).toBe("node");
  });

  test("returns no cleanup when no ref returns one", () => {
    expect(composeRefs<string>({ current: null })("node")).toBeUndefined();
  });

  test("runs cleanups and nulls refs without one", () => {
    const objectRef = { current: null as string | null };
    let cleaned = false;
    const cleanup = composeRefs<string>(objectRef, () => () => {
      cleaned = true;
    })("node");
    expect(typeof cleanup).toBe("function");
    (cleanup as () => void)();
    expect(cleaned).toBe(true);
    expect(objectRef.current).toBeNull();
  });
});
