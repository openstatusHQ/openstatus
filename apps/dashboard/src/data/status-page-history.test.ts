import { describe, expect, it, vi } from "vitest";

import {
  type HistoryEvent,
  type HistoryRow,
  downtimeMinutes,
  historyItems,
  monthMinutes,
  pageMonthUptime,
  eventsForMonth,
  historyMetric,
  historyRows,
  monthKeyToFullLabel,
} from "./status-page-history";

describe("eventsForMonth", () => {
  function event(from: string, to: string | null) {
    return {
      from: new Date(from),
      to: to ? new Date(to) : null,
    } as unknown as HistoryEvent;
  }

  it("keeps events overlapping the UTC month", () => {
    const inside = event("2025-03-10T00:00:00Z", "2025-03-11T00:00:00Z");
    const spanningStart = event("2025-02-28T23:00:00Z", "2025-03-01T01:00:00Z");
    const spanningEnd = event("2025-03-31T23:00:00Z", "2025-04-01T01:00:00Z");
    const before = event("2025-02-01T00:00:00Z", "2025-02-28T23:59:59Z");
    const after = event("2025-04-01T00:00:00Z", "2025-04-02T00:00:00Z");
    expect(
      eventsForMonth(
        [inside, spanningStart, spanningEnd, before, after],
        "2025-03",
      ),
    ).toEqual([inside, spanningStart, spanningEnd]);
  });

  it("uses the month of the page's zone", () => {
    // 23:30 UTC on Oct 31 is already November in Berlin
    const late = event("2026-10-31T23:30:00Z", "2026-10-31T23:45:00Z");
    expect(eventsForMonth([late], "2026-10", "Europe/Berlin")).toEqual([]);
    expect(eventsForMonth([late], "2026-11", "Europe/Berlin")).toEqual([late]);
  });

  it("treats open-ended events as lasting until now", () => {
    vi.useFakeTimers({ now: new Date("2025-05-15T00:00:00Z") });
    try {
      const open = event("2025-03-20T00:00:00Z", null);
      expect(eventsForMonth([open], "2025-04")).toEqual([open]);
      expect(eventsForMonth([open], "2025-06")).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("month labels", () => {
  it("formats the full label", () => {
    expect(monthKeyToFullLabel("2025-10")).toBe("October 2025");
  });
});

describe("historyRows", () => {
  const value = (percentage: number) => ({
    percentage,
    ok: 1,
    degraded: 0,
    error: 0,
  });
  const base = {
    component: { id: 1, name: "API", type: "monitor" as const, monitorId: 1 },
    events: [],
    maintenanceWindows: [],
    excusedOutages: [],
  };
  const monitorRow = {
    ...base,
    unit: "requests" as const,
    months: { "2026-11": value(99) },
    total: value(99),
    runs: {
      months: { "2026-11": value(100) },
      total: null,
    },
  };
  const staticRow = {
    ...base,
    unit: "time" as const,
    months: { "2026-11": value(50) },
    total: value(50),
    runs: null,
  };

  it("keeps requests by default and drops the runs block", () => {
    const [row] = historyRows([monitorRow], "requests");
    expect(row.unit).toBe("requests");
    expect(row.months["2026-11"]?.percentage).toBe(99);
    expect(row).not.toHaveProperty("runs");
  });

  it("swaps in runs where a row has them", () => {
    const [monitor, other] = historyRows([monitorRow, staticRow], "runs");
    expect(monitor.unit).toBe("runs");
    expect(monitor.months["2026-11"]?.percentage).toBe(100);
    expect(monitor.total).toBe(null);
    expect(other.unit).toBe("time");
    expect(other.months["2026-11"]?.percentage).toBe(50);
  });
});

describe("historyMetric", () => {
  it("follows the page mode when the URL names no metric", () => {
    expect(historyMetric(null, "runs")).toBe("runs");
    expect(historyMetric(null, "requests")).toBe("requests");
    expect(historyMetric(null, "duration")).toBe("requests");
  });

  it("keeps the metric the URL asks for", () => {
    expect(historyMetric("requests", "runs")).toBe("requests");
    expect(historyMetric("runs", "requests")).toBe("runs");
  });
});

describe("pageMonthUptime", () => {
  const v = (percentage: number) => ({
    percentage,
    ok: 1,
    degraded: 0,
    error: 0,
  });

  it("averages the rows that have a value", () => {
    const rows = [
      { months: { "2026-10": v(99) } },
      { months: { "2026-10": v(100) } },
      { months: { "2026-10": null } },
    ];
    expect(pageMonthUptime(rows, "2026-10")).toBe(99.5);
  });

  it("is null when no row has a value", () => {
    expect(pageMonthUptime([{ months: {} }], "2026-10")).toBeNull();
  });
});

describe("monthMinutes / downtimeMinutes", () => {
  it("counts a whole past month in the page's zone", () => {
    const now = new Date("2026-12-15T00:00:00Z");
    expect(monthMinutes("2026-11", "UTC", now)).toBe(30 * 1440);
    // a UTC+1 month starts and ends an hour earlier, same length
    expect(monthMinutes("2026-11", "Europe/Berlin", now)).toBe(30 * 1440);
  });

  it("counts the current month only up to now", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    expect(monthMinutes("2026-11", "UTC", now)).toBe(1440);
  });

  it("turns the missing share into minutes", () => {
    const now = new Date("2026-12-15T00:00:00Z");
    expect(downtimeMinutes(99.9, "2026-11", "UTC", now)).toBeCloseTo(43.2);
    expect(downtimeMinutes(null, "2026-11", "UTC", now)).toBeNull();
  });
});

describe("historyItems", () => {
  const from = new Date("2026-11-03T09:00:00Z");
  const to = new Date("2026-11-03T10:00:00Z");
  const row = (id: number, name: string): HistoryRow => ({
    component: { id, name, type: "monitor", monitorId: id },
    unit: "requests",
    months: {},
    total: null,
    events: [
      { id: 7, name: "Latency", type: "report", status: "degraded", from, to },
    ],
    maintenanceWindows: [{ id: 3, title: "Upgrade", mode: "pause", from, to }],
    excusedOutages: [{ id: id * 10, reason: "DNS", from, to }],
  });

  it("merges a shared report or window and lists its components", () => {
    const items = historyItems([row(1, "API"), row(2, "Dashboard")]);
    const report = items.find((i) => i.kind === "event");
    const window = items.find((i) => i.kind === "window");
    expect(report?.components).toEqual(["API", "Dashboard"]);
    expect(window?.components).toEqual(["API", "Dashboard"]);
  });

  it("keeps one excused outage per monitor", () => {
    const items = historyItems([row(1, "API"), row(2, "Dashboard")]);
    expect(items.filter((i) => i.kind === "excused")).toHaveLength(2);
  });

  it("sorts newest first", () => {
    const later = { ...row(1, "API") };
    later.events = [
      ...later.events,
      {
        id: 8,
        name: "Outage",
        type: "incident",
        status: "error",
        from: to,
        to: null,
      },
    ];
    expect(historyItems([later])[0].from).toEqual(to);
  });
});
