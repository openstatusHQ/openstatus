import { describe, expect, it } from "vitest";

import {
  exampleReportMonths,
  formatAvailability,
  monitorReportHref,
  parseMonthKey,
  rarelyOpensOutages,
  reportRange,
} from "./monitor-report.client";

const now = new Date(Date.UTC(2026, 1, 10, 12));

describe("reportRange", () => {
  it("spans the current UTC month and the 11 before it", () => {
    expect(reportRange(now)).toEqual({
      from: new Date(Date.UTC(2025, 2, 1)),
      to: new Date(Date.UTC(2026, 2, 1)),
    });
  });

  it("uses the UTC month even when the local date differs", () => {
    const lateJan = new Date(Date.UTC(2026, 0, 31, 23, 30));
    expect(reportRange(lateJan)).toEqual({
      from: new Date(Date.UTC(2025, 1, 1)),
      to: new Date(Date.UTC(2026, 1, 1)),
    });
  });
});

describe("reportRange with a month", () => {
  it("spans that UTC month", () => {
    expect(reportRange(now, "2024-12")).toEqual({
      from: new Date(Date.UTC(2024, 11, 1)),
      to: new Date(Date.UTC(2025, 0, 1)),
    });
  });

  it.each(["2024-13", "2024-1", "nope", ""])(
    "ignores the malformed month %j",
    (month) => {
      expect(parseMonthKey(month)).toBeNull();
      expect(reportRange(now, month)).toEqual(reportRange(now));
    },
  );
});

describe("monitorReportHref", () => {
  it("opens the yearly report for an outage inside it", () => {
    expect(monitorReportHref(7, new Date(Date.UTC(2025, 2, 1)), now)).toBe(
      "/monitors/7/report#outages",
    );
  });

  it("opens the UTC month of an older outage", () => {
    expect(monitorReportHref(7, new Date(Date.UTC(2025, 1, 28, 23)), now)).toBe(
      "/monitors/7/report?month=2025-02#outages",
    );
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

describe("rarelyOpensOutages", () => {
  it("is true for heartbeats and private-location-only monitors", () => {
    expect(rarelyOpensOutages({ jobType: "heartbeat", regions: [] })).toBe(
      true,
    );
    expect(
      rarelyOpensOutages({
        jobType: "http",
        regions: [],
        privateLocations: [{ id: 1 }],
      }),
    ).toBe(true);
    expect(rarelyOpensOutages({ jobType: "http", regions: ["ams"] })).toBe(
      false,
    );
  });
});
