import { describe, expect, test } from "vitest";

import { monthsAhead, pickableDay } from "./dates.mjs";

describe("pickableDay", () => {
  test("is at least two days out and between the 8th and the 21st", () => {
    for (let offset = 0; offset < 366; offset++) {
      const from = new Date(2026, 0, 1 + offset);
      const day = pickableDay(from);
      expect(day.getTime() - from.getTime()).toBeGreaterThanOrEqual(
        2 * 86_400_000 - 3_600_000,
      );
      expect(day.getDate()).toBeGreaterThanOrEqual(8);
      expect(day.getDate()).toBeLessThanOrEqual(21);
    }
  });

  test("does not change the date it is given", () => {
    const from = new Date(2026, 9, 25);
    pickableDay(from);
    expect(from.getDate()).toBe(25);
  });
});

describe("monthsAhead", () => {
  test("counts across a year boundary", () => {
    expect(monthsAhead(new Date(2026, 11, 28), new Date(2027, 0, 8))).toBe(1);
    expect(monthsAhead(new Date(2026, 9, 25), new Date(2026, 10, 8))).toBe(1);
    expect(monthsAhead(new Date(2026, 9, 2), new Date(2026, 9, 9))).toBe(0);
  });
});
