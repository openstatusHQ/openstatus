import { describe, expect, test } from "vitest";

import { monthRange } from "../../frozen-uptime/compute";
import {
  completeMonths,
  liveUntilFrozen,
  monthOf,
  monthsBetween,
  splitByMonth,
} from "../months";

describe("UTC month boundaries", () => {
  test("months are calendar months in UTC", () => {
    expect(monthRange("2026-10-01")).toEqual({
      start: Date.UTC(2026, 9, 1),
      end: Date.UTC(2026, 10, 1),
    });
  });

  test("the last UTC hour of a month belongs to that month", () => {
    expect(monthOf(Date.UTC(2026, 9, 31, 23, 30))).toBe("2026-10-01");
    expect(monthOf(Date.UTC(2026, 10, 1))).toBe("2026-11-01");
  });

  test("the current and complete months", () => {
    const now = new Date(Date.UTC(2026, 10, 1, 2));
    expect(monthOf(now)).toBe("2026-11-01");
    expect(completeMonths(now, 2)).toEqual(["2026-09-01", "2026-10-01"]);
  });

  test("months between two months, across a year", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
  });

  test("a window across a month boundary is split at it", () => {
    const from = Date.UTC(2026, 9, 31, 22);
    const to = Date.UTC(2026, 10, 1, 1);
    expect(splitByMonth(from, to)).toEqual([
      { month: "2026-10-01", start: from, end: Date.UTC(2026, 10, 1) },
      { month: "2026-11-01", start: Date.UTC(2026, 10, 1), end: to },
    ]);
  });

  test("the previous month is live only while its runs are kept", () => {
    expect(liveUntilFrozen("2026-10-01", new Date(Date.UTC(2026, 10, 2)))).toBe(
      true,
    );
    expect(
      liveUntilFrozen("2026-10-01", new Date(Date.UTC(2026, 10, 20))),
    ).toBe(false);
    expect(liveUntilFrozen("2026-09-01", new Date(Date.UTC(2026, 10, 2)))).toBe(
      false,
    );
  });
});
