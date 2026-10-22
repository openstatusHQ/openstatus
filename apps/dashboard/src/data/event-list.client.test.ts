import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import {
  formatDurationShort,
  formatEventDate,
  formatEventWindow,
  groupByMonth,
  pluralize,
} from "./event-list.client";

// mid-month dates keep the local-time bucketing independent of the runner's TZ
const item = (id: number, iso: string) => ({ id, date: new Date(iso) });

describe("groupByMonth", () => {
  it("buckets by month and keeps the input order", () => {
    const groups = groupByMonth(
      [
        item(1, "2026-10-14T12:00:00Z"),
        item(2, "2026-10-10T12:00:00Z"),
        item(3, "2026-09-15T12:00:00Z"),
        item(4, "2025-09-15T12:00:00Z"),
      ],
      (i) => i.date,
    );
    expect(groups.map((g) => g.key)).toEqual(["2026-10", "2026-09", "2025-09"]);
    expect(groups.map((g) => g.label)).toEqual([
      "October 2026",
      "September 2026",
      "September 2025",
    ]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual([1, 2]);
  });

  it("returns no groups for no items", () => {
    expect(groupByMonth([], () => new Date())).toEqual([]);
  });
});

describe("pluralize", () => {
  it("keeps a count of 1 singular", () => {
    expect(pluralize(1, "update")).toBe("1 update");
    expect(pluralize(0, "update")).toBe("0 updates");
    expect(pluralize(3, "downtime")).toBe("3 downtimes");
  });
});

describe("formatDurationShort", () => {
  it("picks the largest whole unit", () => {
    const m = 60_000;
    expect(formatDurationShort(10_000)).toBe("1m");
    expect(formatDurationShort(45 * m)).toBe("45m");
    expect(formatDurationShort(150 * m)).toBe("3h");
    expect(formatDurationShort(4 * 24 * 60 * m)).toBe("4d");
  });
});

describe("formatEventWindow", () => {
  // local-time constructors keep the expectation independent of the runner's TZ
  const at = (day: number, h: number) => new Date(2026, 9, day, h, 0);
  it("formats a date and a same-day window", () => {
    expect(formatEventDate(at(18, 21))).toBe("Sun 18 Oct, 21:00");
    expect(formatEventWindow(at(19, 2), at(19, 6))).toBe(
      "Mon 19 Oct, 02:00–06:00",
    );
  });
  it("dates the end of a window past midnight", () => {
    expect(formatEventWindow(at(18, 22), at(19, 0))).toBe(
      "Sun 18 Oct, 22:00–Mon 19 Oct, 00:00",
    );
  });
});
