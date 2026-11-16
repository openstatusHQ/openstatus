import { describe, expect, test } from "vitest";

import {
  allowedDowntime,
  budgetShare,
  excusedWindowContext,
  formatBudgetLeft,
  formatExcusedWindow,
  formatUptimeCoverage,
  formatUptimeDuration,
  formatUptimeMonth,
  parseUptimeTarget,
  uptimeMonthOf,
  uptimeTreatmentTotals,
} from "./reports.client";

describe("allowedDowntime", () => {
  test.each([
    [99_000, "7h 12m"],
    [99_500, "3h 36m"],
    [99_900, "43m 12s"],
    [99_950, "21m 36s"],
    [99_990, "4m 19s"],
    [99_123, "6h 18m 52s"],
    [97_000, "21h 36m"],
    [100_000, "0s"],
  ])("%i allows %s in 30 days", (target, expected) => {
    expect(allowedDowntime(target)).toBe(expected);
  });
});

describe("formatUptimeDuration", () => {
  test.each([
    [0, "0s"],
    [999, "0s"],
    [30_000, "30s"],
    [5 * 60_000, "5m"],
    [(43 * 60 + 12) * 1000, "43m 12s"],
    [(3 * 3600 + 36 * 60 + 59) * 1000, "3h 36m"],
    [72 * 3600_000, "72h"],
    [(3600 + 5) * 1000, "1h"],
    [-4 * 60_000, "4m"],
  ])("%i ms → %s", (ms, expected) => {
    expect(formatUptimeDuration(ms)).toBe(expected);
  });
});

describe("formatBudgetLeft", () => {
  test("left while there is budget, over once it is spent past zero", () => {
    expect(formatBudgetLeft(12 * 60_000)).toBe("12m left");
    expect(formatBudgetLeft(0)).toBe("0s left");
    expect(formatBudgetLeft(-4 * 60_000)).toBe("4m over");
  });
});

describe("budgetShare", () => {
  test("clamps to the bar and spends a zero budget whole", () => {
    expect(budgetShare(15, 60)).toBe(0.25);
    expect(budgetShare(90, 60)).toBe(1);
    expect(budgetShare(-5, 60)).toBe(0);
    expect(budgetShare(0, 0)).toBe(0);
    expect(budgetShare(1, 0)).toBe(1);
  });
});

describe("formatUptimeCoverage", () => {
  test("floors to one decimal", () => {
    expect(formatUptimeCoverage(100_000)).toBe("100.0");
    expect(formatUptimeCoverage(99_899)).toBe("99.8");
    expect(formatUptimeCoverage(0)).toBe("0.0");
  });
});

describe("parseUptimeTarget", () => {
  test.each([
    ["99.5", 99_500],
    ["99.95", 99_950],
    ["100", 100_000],
    ["0", null],
    ["100.001", null],
    ["99.9999", null],
    ["abc", null],
  ])("%s → %s", (value, expected) => {
    expect(parseUptimeTarget(value)).toBe(expected);
  });
});

describe("formatUptimeMonth", () => {
  test("short month in UTC, with the year on request", () => {
    expect(formatUptimeMonth("2026-01-01")).toBe("Jan");
    expect(formatUptimeMonth("2025-12-01", { year: true })).toBe("Dec 2025");
  });
});

describe("uptimeMonthOf", () => {
  test("the month in the given zone, not in UTC", () => {
    const date = new Date(Date.UTC(2026, 10, 30, 23, 30));
    expect(uptimeMonthOf(date, "UTC")).toBe("2026-11-01");
    expect(uptimeMonthOf(date, "Europe/Berlin")).toBe("2026-12-01");
    expect(uptimeMonthOf(date, "America/New_York")).toBe("2026-11-01");
  });
});

describe("formatExcusedWindow", () => {
  test("a window within a day shows its date once, in UTC", () => {
    expect(
      formatExcusedWindow(
        new Date(Date.UTC(2026, 10, 4, 22)),
        new Date(Date.UTC(2026, 10, 4, 23)),
      ),
    ).toBe("Nov 4, 22:00 – 23:00");
  });

  test("a window across days shows both dates", () => {
    expect(
      formatExcusedWindow(
        new Date(Date.UTC(2026, 9, 31, 23)),
        new Date(Date.UTC(2026, 10, 1, 1)),
      ),
    ).toBe("Oct 31, 23:00 – Nov 1, 01:00");
  });

  test("reads in the given time zone", () => {
    expect(
      formatExcusedWindow(
        new Date(Date.UTC(2026, 10, 4, 22)),
        new Date(Date.UTC(2026, 10, 4, 23)),
        "Europe/Berlin",
      ),
    ).toBe("Nov 4, 23:00 – Nov 5, 00:00");
  });
});

describe("excusedWindowContext", () => {
  const month = (m: string, met: boolean | null, state = "sealed") => ({
    month: m,
    met,
    state,
  });
  const policy = {
    months: ["2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01"],
    monitors: [
      {
        months: [
          month("2026-08-01", false),
          month("2026-09-01", false),
          month("2026-10-01", true, "preview"),
          month("2026-11-01", false, "live"),
        ],
      },
      {
        months: [
          month("2026-08-01", true),
          month("2026-09-01", true),
          month("2026-10-01", true, "preview"),
          month("2026-11-01", true, "live"),
        ],
      },
    ],
    excusedWindows: [
      { kind: "emergency" as const, from: new Date(Date.UTC(2026, 9, 2)) },
      { kind: "maintenance" as const, from: new Date(Date.UTC(2026, 9, 20)) },
      { kind: "maintenance" as const, from: new Date(Date.UTC(2026, 8, 3)) },
    ],
  };

  test("counts misses in the last two complete months only, never the live one", () => {
    expect(excusedWindowContext(policy, "maintenance")).toMatchObject({
      missed: 1,
      months: ["2026-09-01", "2026-10-01"],
    });
  });

  test("names the newest window of the same kind", () => {
    expect(excusedWindowContext(policy, "maintenance").lastOfKind).toEqual(
      new Date(Date.UTC(2026, 9, 20)),
    );
    expect(excusedWindowContext(policy, "other").lastOfKind).toBeNull();
  });
});

describe("uptimeTreatmentTotals", () => {
  test("sums per treatment in label order and drops empty ones", () => {
    expect(
      uptimeTreatmentTotals([
        { treatment: "excused", startedAt: 0, endedAt: 5 },
        { treatment: "counted", startedAt: 10, endedAt: 20 },
        { treatment: "counted", startedAt: 40, endedAt: 60 },
        { treatment: "unmeasured", startedAt: 60, endedAt: 60 },
      ]),
    ).toEqual([
      { treatment: "counted", ms: 30 },
      { treatment: "excused", ms: 5 },
    ]);
  });
});
