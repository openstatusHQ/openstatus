import { describe, expect, test } from "vitest";

import {
  allowedDowntime,
  excusedWindowContext,
  formatExcusedWindow,
  formatSlaMonth,
  parseSlaTarget,
} from "./sla-policies.client";

describe("allowedDowntime", () => {
  test.each([
    [99_000, "7h 12m"],
    [99_500, "3h 36m"],
    [99_900, "43m 12s"],
    [99_950, "21m 36s"],
    [99_990, "4m 19s"],
    [100_000, "0s"],
  ])("%i allows %s in 30 days", (target, expected) => {
    expect(allowedDowntime(target)).toBe(expected);
  });
});

describe("parseSlaTarget", () => {
  test.each([
    ["99.5", 99_500],
    ["99.95", 99_950],
    ["100", 100_000],
    ["0", null],
    ["100.001", null],
    ["99.9999", null],
    ["abc", null],
  ])("%s → %s", (value, expected) => {
    expect(parseSlaTarget(value)).toBe(expected);
  });
});

describe("formatSlaMonth", () => {
  test("short month in UTC, with the year on request", () => {
    expect(formatSlaMonth("2026-01-01")).toBe("Jan");
    expect(formatSlaMonth("2025-12-01", { year: true })).toBe("Dec 2025");
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
