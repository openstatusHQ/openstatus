import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { composeEventHandlers, composeRefs } from "./composition";

describe("composeEventHandlers", () => {
  it("runs the original handler before ours", () => {
    const calls: string[] = [];
    const handler = composeEventHandlers(
      () => calls.push("original"),
      () => calls.push("ours"),
    );
    handler(new Event("click"));
    expect(calls).toEqual(["original", "ours"]);
  });

  it("skips ours when the original prevents default", () => {
    let called = false;
    const handler = composeEventHandlers(
      (e: Event) => e.preventDefault(),
      () => {
        called = true;
      },
    );
    handler(new Event("click", { cancelable: true }));
    expect(called).toBe(false);
  });

  it("runs ours anyway when the check is disabled", () => {
    let called = false;
    const handler = composeEventHandlers(
      (e: Event) => e.preventDefault(),
      () => {
        called = true;
      },
      { checkForDefaultPrevented: false },
    );
    handler(new Event("click", { cancelable: true }));
    expect(called).toBe(true);
  });

  it("tolerates missing handlers", () => {
    expect(() => composeEventHandlers()(new Event("click"))).not.toThrow();
  });
});

describe("composeRefs", () => {
  it("assigns object refs and calls callback refs", () => {
    const objectRef = { current: null as string | null };
    let callbackValue: string | null = null;
    const ref = composeRefs<string | null>(objectRef, (v) => {
      callbackValue = v;
    });
    ref("node");
    expect(objectRef.current).toBe("node");
    expect(callbackValue).toBe("node");
  });

  it("ignores null and undefined refs", () => {
    const ref = composeRefs<string>(null, undefined);
    expect(ref("node")).toBeUndefined();
  });

  it("returns no cleanup when no ref returns one", () => {
    const ref = composeRefs<string>({ current: null }, () => {});
    expect(ref("node")).toBeUndefined();
  });

  it("runs ref cleanups and nulls the other refs on cleanup", () => {
    const objectRef = { current: null as string | null };
    let cleaned = false;
    const ref = composeRefs<string | null>(objectRef, () => () => {
      cleaned = true;
    });
    const cleanup = ref("node");
    expect(objectRef.current).toBe("node");
    expect(typeof cleanup).toBe("function");
    (cleanup as () => void)();
    expect(cleaned).toBe(true);
    expect(objectRef.current).toBeNull();
  });
});
