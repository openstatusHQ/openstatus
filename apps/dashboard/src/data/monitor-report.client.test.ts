import { describe, expect, it } from "vitest";

import {
  dayOfLocalDate,
  exampleReportMonths,
  formatAvailability,
  localDateOfDay,
  monitorReportHref,
  rangeDays,
  rarelyOpensOutages,
  reportPresets,
  reportRange,
} from "./monitor-report.client";

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

describe("rangeDays", () => {
  it("turns a half-open UTC range into inclusive days", () => {
    expect(
      rangeDays({
        from: new Date(Date.UTC(2026, 1, 1)),
        to: new Date(Date.UTC(2026, 2, 1)),
      }),
    ).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("round-trips through reportRange as a custom period", () => {
    const range = reportRange({ period: "3m" }, now);
    expect(reportRange({ period: "custom", ...rangeDays(range) }, now)).toEqual(
      range,
    );
  });
});

describe("picker days", () => {
  it("round-trips a day through the local date", () => {
    const date = localDateOfDay("2026-02-28");
    expect(date && dayOfLocalDate(date)).toBe("2026-02-28");
    expect(localDateOfDay(null)).toBeUndefined();
  });
});

describe("reportPresets", () => {
  it("lists every preset but custom, on the range's calendar days", () => {
    const presets = reportPresets(now);
    expect(presets.map((p) => p.label)).toEqual([
      "This month",
      "Last month",
      "Last 3 months",
      "Last 6 months",
      "Last 12 months",
    ]);
    expect(dayOfLocalDate(presets[1].from)).toBe("2026-01-01");
    expect(dayOfLocalDate(presets[1].to)).toBe("2026-01-31");
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

describe("custom period input", () => {
  const thisMonth = reportRange({ period: "this-month" }, now);

  it.each([
    ["an impossible day", "2026-02-30", "2026-03-05"],
    ["a malformed day", "yesterday", "2026-03-05"],
    ["an end before the start", "2026-03-05", "2026-03-01"],
  ])("falls back to this month for %s", (_case, from, to) => {
    expect(reportRange({ period: "custom", from, to }, now)).toEqual(thisMonth);
  });

  it("gives the picker nothing for a malformed day", () => {
    expect(localDateOfDay("2026-13-01")).toBeUndefined();
    expect(localDateOfDay("nope")).toBeUndefined();
  });
});

describe("monitorReportHref", () => {
  it("opens the month an older outage started in", () => {
    expect(
      monitorReportHref(7, new Date(Date.UTC(2025, 10, 30, 23)), now),
    ).toBe(
      "/monitors/7/report?period=custom&from=2025-11-01&to=2025-11-30#outages",
    );
  });

  it("keeps the default period for an outage of the current month", () => {
    expect(monitorReportHref(7, new Date(Date.UTC(2026, 1, 3)), now)).toBe(
      "/monitors/7/report#outages",
    );
  });
});
