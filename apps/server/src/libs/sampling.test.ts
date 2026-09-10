import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";

import { shouldSample } from "./sampling";

function withRandom<T>(value: number, fn: () => T): T {
  const random = stub(Math, "random", () => value);
  try {
    return fn();
  } finally {
    random.restore();
  }
}

describe("shouldSample", () => {
  test("always keeps shed and rate-limited events, even when random would drop them", () => {
    withRandom(0.99, () => {
      expect(shouldSample({ status_code: 503, shed: true })).toBe(true);
      expect(shouldSample({ status_code: 429, rate_limited: true })).toBe(true);
      // status alone is enough: the flag may be missing on a 429 from a route
      expect(shouldSample({ status_code: 429 })).toBe(true);
      expect(shouldSample({ status_code: 503 })).toBe(true);
    });
  });

  test("keeps 5xx, errors and slow requests", () => {
    withRandom(0.99, () => {
      expect(shouldSample({ status_code: 500 })).toBe(true);
      expect(shouldSample({ status_code: 200, error: { type: "x" } })).toBe(
        true,
      );
      expect(shouldSample({ status_code: 200, duration_ms: 2001 })).toBe(true);
    });
  });

  test("samples ordinary requests at 20%", () => {
    const ok = { status_code: 200, duration_ms: 12 };
    expect(withRandom(0.19, () => shouldSample(ok))).toBe(true);
    expect(withRandom(0.2, () => shouldSample(ok))).toBe(false);
    expect(withRandom(0.99, () => shouldSample({ status_code: 404 }))).toBe(
      false,
    );
  });
});
