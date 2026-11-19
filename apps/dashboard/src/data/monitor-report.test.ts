import { describe, expect, it } from "vitest";

import {
  exampleReportMonths,
  formatAvailability,
  reportRange,
} from "./monitor-report";

const now = new Date(Date.UTC(2026, 1, 10, 12));

describe("reportRange", () => {
  it("this month spans the whole UTC month", () => {
    expect(reportRange({ period: "this-month" }, now)).toEqual({
      from: new Date(Date.UTC(2026, 1, 1)),
      to: new Date(Date.UTC(2026, 2, 1)),
    });
  });

  it("uses the UTC month even when the local date differs", () => {
    const lateJan = new Date(Date.UTC(2026, 0, 31, 23, 30));
    expect(reportRange({ period: "this-month" }, lateJan)).toEqual({
      from: new Date(Date.UTC(2026, 0, 1)),
      to: new Date(Date.UTC(2026, 1, 1)),
    });
  });

  it("last N months are complete months before this one", () => {
    expect(reportRange({ period: "last-month" }, now)).toEqual({
      from: new Date(Date.UTC(2026, 0, 1)),
      to: new Date(Date.UTC(2026, 1, 1)),
    });
    expect(reportRange({ period: "3m" }, now)).toEqual({
      from: new Date(Date.UTC(2025, 10, 1)),
      to: new Date(Date.UTC(2026, 1, 1)),
    });
    expect(reportRange({ period: "12m" }, now).from).toEqual(
      new Date(Date.UTC(2025, 1, 1)),
    );
  });

  it("a custom range covers whole UTC days, end day included", () => {
    expect(
      reportRange(
        { period: "custom", from: "2026-01-05", to: "2026-01-10" },
        now,
      ),
    ).toEqual({
      from: new Date(Date.UTC(2026, 0, 5)),
      to: new Date(Date.UTC(2026, 0, 11)),
    });
  });

  it("an incomplete or reversed custom range falls back to this month", () => {
    const thisMonth = reportRange({ period: "this-month" }, now);
    expect(reportRange({ period: "custom", from: "2026-01-05" }, now)).toEqual(
      thisMonth,
    );
    expect(
      reportRange(
        { period: "custom", from: "2026-01-10", to: "2026-01-05" },
        now,
      ),
    ).toEqual(thisMonth);
  });
});

describe("formatAvailability", () => {
  it("truncates instead of rounding up to 100%", () => {
    expect(formatAvailability(99.9996)).toBe("99.999%");
    expect(formatAvailability(99.999)).toBe("99.999%");
    expect(formatAvailability(100)).toBe("100.000%");
  });

  it("shows an em dash without data", () => {
    expect(formatAvailability(null)).toBe("—");
  });
});

describe("exampleReportMonths", () => {
  it("ends at the current UTC month, oldest first, across a year boundary", () => {
    const months = exampleReportMonths(now).map((m) => m.month);
    expect(months).toEqual([
      "2025-09-01",
      "2025-10-01",
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
  });

  it("derives availability and outages from the downtime", () => {
    for (const m of exampleReportMonths(now)) {
      expect(m.outages).toBe(m.downtimeMs > 0 ? 1 : 0);
      expect(m.availability === 100).toBe(m.downtimeMs === 0);
      expect(m.availability).toBeGreaterThan(99.9);
    }
  });
});
