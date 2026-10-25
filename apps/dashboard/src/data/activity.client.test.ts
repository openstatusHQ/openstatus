import { differenceInCalendarDays } from "date-fns";
import { describe, expect, it } from "vitest";

import {
  activityRange,
  groupByDay,
  levelFor,
  median,
  monthsInRange,
  mostCommon,
  percentInRange,
  spanInRange,
} from "./activity.client";

const now = new Date(2026, 9, 19, 12, 0); // Monday

describe("activityRange", () => {
  it("spans 53 Monday-start weeks ending this week", () => {
    const { from, to } = activityRange(now);
    expect(from.getDay()).toBe(1);
    expect(to.getDay()).toBe(0);
    expect(to >= now).toBe(true);
    expect(differenceInCalendarDays(to, from) + 1).toBe(53 * 7);
  });
});

describe("groupByDay", () => {
  const range = { from: new Date(2026, 9, 1), to: new Date(2026, 9, 10) };

  it("places a span on every day it touches, clipped to the range", () => {
    const items = [{ start: new Date(2026, 8, 30), end: new Date(2026, 9, 2) }];
    const days = groupByDay(range, items, (i) => i, now);
    expect(days).toHaveLength(10);
    expect(days.slice(0, 3).map((d) => d.items.length)).toEqual([1, 1, 0]);
  });

  it("runs an open span until now", () => {
    const items = [{ start: new Date(2026, 9, 8), end: null }];
    const days = groupByDay(range, items, (i) => i, new Date(2026, 9, 9));
    expect(days.map((d) => d.items.length).slice(7)).toEqual([1, 1, 0]);
  });

  it("drops spans entirely outside the range", () => {
    const items = [
      { start: new Date(2026, 9, 11), end: new Date(2026, 9, 12) },
    ];
    const days = groupByDay(range, items, (i) => i, now);
    expect(days.every((d) => d.items.length === 0)).toBe(true);
  });
});

describe("spanInRange", () => {
  const range = { from: new Date(2026, 9, 1), to: new Date(2026, 9, 10) };

  it("counts only the overlap", () => {
    const ms = spanInRange(range, {
      start: new Date(2026, 8, 30),
      end: new Date(2026, 9, 2),
    });
    expect(ms).toBe(86_400_000);
  });
});

describe("percentInRange / monthsInRange", () => {
  const range = { from: new Date(2026, 0, 1), to: new Date(2026, 2, 1) };

  it("clamps to the axis", () => {
    expect(percentInRange(range, new Date(2025, 0, 1))).toBe(0);
    expect(percentInRange(range, new Date(2027, 0, 1))).toBe(100);
    expect(percentInRange(range, new Date(2026, 0, 1))).toBe(0);
  });

  it("lists month starts inside the range", () => {
    expect(monthsInRange(range).map((m) => m.date.getMonth())).toEqual([
      0, 1, 2,
    ]);
  });
});

describe("small stats", () => {
  it("levelFor", () => {
    expect(levelFor(1, [2, 4])).toBe(1);
    expect(levelFor(3, [2, 4])).toBe(2);
    expect(levelFor(4, [2, 4])).toBe(3);
  });

  it("median", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it("mostCommon", () => {
    expect(mostCommon([])).toBeNull();
    expect(mostCommon(["a", "b", "b"])).toBe("b");
    expect(mostCommon([2, 1, 1])).toBe(1);
  });
});
