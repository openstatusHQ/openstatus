import { describe, expect, it, vi } from "vitest";

import {
  type HistoryEvent,
  cellFromPercentage,
  eventsForMonth,
  getColumnVisibility,
  monthKeyToFullLabel,
  monthCountLines,
  monthKeyToLabel,
  parseWindow,
} from "./status-page-history";

describe("parseWindow", () => {
  it("accepts the known windows", () => {
    expect(parseWindow("6")).toBe(6);
    expect(parseWindow("12")).toBe(12);
    expect(parseWindow("24")).toBe(24);
  });

  it("falls back to the first window", () => {
    expect(parseWindow("3")).toBe(6);
    expect(parseWindow("abc")).toBe(6);
    expect(parseWindow("")).toBe(6);
  });
});

describe("cellFromPercentage", () => {
  it("marks missing data", () => {
    expect(cellFromPercentage(null)).toEqual({
      percentage: null,
      status: "no-data",
    });
  });

  it("marks the current month as in progress", () => {
    expect(cellFromPercentage(50, true).status).toBe("in-progress");
  });

  it("applies the thresholds", () => {
    expect(cellFromPercentage(100).status).toBe("operational");
    expect(cellFromPercentage(99.9).status).toBe("operational");
    expect(cellFromPercentage(99.89).status).toBe("degraded");
    expect(cellFromPercentage(99).status).toBe("degraded");
    expect(cellFromPercentage(98.99).status).toBe("down");
  });
});

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
  it("formats short and full labels", () => {
    expect(monthKeyToLabel("2025-10")).toBe("Oct 25");
    expect(monthKeyToFullLabel("2025-10")).toBe("October 2025");
  });
});

describe("getColumnVisibility", () => {
  it("shows everything when the window covers all months", () => {
    expect(getColumnVisibility(12, 12)).toEqual({});
    expect(getColumnVisibility(24, 12)).toEqual({});
  });

  it("hides the slots beyond the window", () => {
    expect(getColumnVisibility(6, 9)).toEqual({
      "7": false,
      "8": false,
      "9": false,
    });
  });
});

describe("monthCountLines", () => {
  const DAY = 86_400_000;

  it("shows up of total runs and the down count", () => {
    expect(
      monthCountLines({ percentage: 99.537, up: 8600, total: 8640 }, "runs"),
    ).toEqual(["8,600 of 8,640 runs up", "40 down"]);
  });

  it("drops the down line without failures", () => {
    expect(
      monthCountLines({ percentage: 100, up: 51840, total: 51840 }, "requests"),
    ).toEqual(["51,840 of 51,840 requests up"]);
  });

  it("uses the singular for a single run", () => {
    expect(monthCountLines({ percentage: 0, up: 0, total: 1 }, "runs")).toEqual(
      ["0 of 1 run up", "1 down"],
    );
  });

  it("formats time months as downtime of the covered span", () => {
    const total = 30 * DAY;
    const down = (2 * 60 + 32) * 60_000;
    expect(
      monthCountLines({ percentage: 99.648, up: total - down, total }, "time"),
    ).toEqual(["2h 32m down of 30d"]);
  });

  it("says no downtime when a time month has none", () => {
    expect(
      monthCountLines(
        { percentage: 100, up: 7.5 * DAY, total: 7.5 * DAY },
        "time",
      ),
    ).toEqual(["No downtime in 7d 12h"]);
  });
});
