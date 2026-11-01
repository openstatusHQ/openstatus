import { differenceInCalendarDays } from "date-fns";
import { describe, expect, it } from "vitest";

import {
  activityPeriod,
  activityRange,
  groupByDay,
  levelFor,
  spansOnDay,
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

  it("extends to the week of `until`, at most 4 weeks ahead", () => {
    const base = activityRange(now);
    const inTwoWeeks = activityRange(now, new Date(2026, 10, 4));
    expect(inTwoWeeks.from).toEqual(base.from);
    expect(differenceInCalendarDays(inTwoWeeks.to, base.to)).toBe(14);
    const farOut = activityRange(now, new Date(2027, 5, 1));
    expect(differenceInCalendarDays(farOut.to, base.to)).toBe(28);
    expect(activityRange(now, new Date(2026, 9, 21)).to).toEqual(base.to);
  });
});

describe("activityPeriod", () => {
  it("names the lookahead only when there is one", () => {
    expect(activityPeriod(activityRange(now), now)).toBe("Last 12 months");
    expect(activityPeriod(activityRange(now, new Date(2026, 9, 28)), now)).toBe(
      "Last 12 months · next 1 week",
    );
    expect(activityPeriod(activityRange(now, new Date(2026, 10, 4)), now)).toBe(
      "Last 12 months · next 2 weeks",
    );
  });
});

describe("groupByDay", () => {
  const range = { from: new Date(2026, 9, 1), to: new Date(2026, 9, 10) };

  it("places a span on every day it touches, clipped to the range", () => {
    const items = [
      { start: new Date(2026, 8, 30), end: new Date(2026, 9, 2, 12) },
    ];
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

describe("small stats", () => {
  it("levelFor", () => {
    expect(levelFor(1, [2, 4])).toBe(1);
    expect(levelFor(3, [2, 4])).toBe(2);
    expect(levelFor(4, [2, 4])).toBe(3);
  });
});

describe("day boundaries", () => {
  const range = { from: new Date(2026, 9, 1), to: new Date(2026, 9, 10) };

  it("leaves a span ending exactly at midnight off the next day", () => {
    const items = [
      { start: new Date(2026, 9, 2, 22), end: new Date(2026, 9, 3) },
    ];
    const days = groupByDay(range, items, (i) => i, now);
    expect(days.slice(1, 3).map((d) => d.items.length)).toEqual([1, 0]);
  });

  it("counts overlapping spans on a day once", () => {
    const day = new Date(2026, 9, 2);
    const spans = [
      { start: new Date(2026, 9, 2, 10, 0), end: new Date(2026, 9, 2, 10, 3) },
      { start: new Date(2026, 9, 2, 10, 1), end: new Date(2026, 9, 2, 10, 4) },
      { start: new Date(2026, 9, 2, 23, 0), end: new Date(2026, 9, 3, 1, 0) },
    ];
    expect(spansOnDay(day, spans, now)).toBe((4 + 60) * 60 * 1000);
  });
});
