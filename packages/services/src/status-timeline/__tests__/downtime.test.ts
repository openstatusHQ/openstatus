import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { type WeightedInterval, mergedDowntimeMs } from "../downtime";

const HOUR = 3_600_000;

function iv(from: number, to: number, weight = 1): WeightedInterval {
  return { from, to, weight };
}

describe("mergedDowntimeMs", () => {
  test("empty input and single interval", () => {
    expect(mergedDowntimeMs([])).toBe(0);
    expect(mergedDowntimeMs([iv(0, 2 * HOUR)])).toBe(2 * HOUR);
    expect(mergedDowntimeMs([iv(0, 2 * HOUR, 0.5)])).toBe(1 * HOUR);
  });

  test("disjoint intervals sum, identical overlaps count once", () => {
    expect(mergedDowntimeMs([iv(0, HOUR), iv(2 * HOUR, 3 * HOUR)])).toBe(
      2 * HOUR,
    );
    expect(mergedDowntimeMs([iv(0, 2 * HOUR), iv(0, 2 * HOUR)])).toBe(2 * HOUR);
  });

  test("partial overlap takes the max weight per slice, never the sum", () => {
    // [0,2h] w=0.5 and [1h,3h] w=1 → 1h*0.5 + 2h*1 = 2.5h
    expect(
      mergedDowntimeMs([iv(0, 2 * HOUR, 0.5), iv(HOUR, 3 * HOUR, 1)]),
    ).toBe(2.5 * HOUR);
    // full containment: heavier inner interval wins only for its span
    // [0,4h] w=0.5 containing [1h,2h] w=1 → 3h*0.5 + 1h*1 = 2.5h
    expect(
      mergedDowntimeMs([iv(0, 4 * HOUR, 0.5), iv(HOUR, 2 * HOUR, 1)]),
    ).toBe(2.5 * HOUR);
  });

  test("adjacent intervals sharing a boundary don't double-count the edge", () => {
    expect(mergedDowntimeMs([iv(0, HOUR), iv(HOUR, 2 * HOUR)])).toBe(2 * HOUR);
  });
});
