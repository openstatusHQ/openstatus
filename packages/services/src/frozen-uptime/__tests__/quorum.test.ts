import { describe, expect, test } from "vitest";

import {
  runsBy,
  runsByDay,
  type QuorumHistogramRow,
  quorumRegionCount,
} from "../quorum";

function row(overrides: Partial<QuorumHistogramRow>): QuorumHistogramRow {
  return {
    monitorId: "1",
    day: "2026-11-02 00:00:00",
    errorRegions: 0,
    degradedOrErrorRegions: 0,
    runs: 1,
    ...overrides,
  };
}

describe("quorumRegionCount", () => {
  test("counts the monitor's cloud regions", () => {
    expect(quorumRegionCount("ams,fra,iad")).toBe(3);
  });

  test("a region listed twice counts once", () => {
    expect(quorumRegionCount("ams,fra,ams, fra,iad")).toBe(3);
  });

  test("private-only monitors get none", () => {
    expect(quorumRegionCount("")).toBeNull();
    expect(quorumRegionCount(" , ")).toBeNull();
  });
});

describe("runsByDay", () => {
  test("1 of 6 regions failing keeps the run up", () => {
    expect(
      runsByDay(
        [row({ errorRegions: 1, degradedOrErrorRegions: 1, runs: 4 })],
        6,
      ).get("2026-11-02"),
    ).toEqual({ ok: 4, degraded: 0, error: 0 });
  });

  test("3 of 6 regions failing puts the run down", () => {
    expect(
      runsByDay(
        [
          row({ errorRegions: 3, degradedOrErrorRegions: 3, runs: 2 }),
          row({ errorRegions: 0, degradedOrErrorRegions: 0, runs: 8 }),
        ],
        6,
      ).get("2026-11-02"),
    ).toEqual({ ok: 8, degraded: 0, error: 2 });
  });

  test("2 of 6 degraded with no errors stays ok", () => {
    expect(
      runsByDay([row({ degradedOrErrorRegions: 2, runs: 5 })], 6).get(
        "2026-11-02",
      ),
    ).toEqual({ ok: 5, degraded: 0, error: 0 });
  });

  test("3 of 6 degraded or failing, with fewer than half failing, is degraded", () => {
    expect(
      runsByDay(
        [
          row({ errorRegions: 2, degradedOrErrorRegions: 3, runs: 3 }),
          row({ runs: 1 }),
        ],
        6,
      ).get("2026-11-02"),
    ).toEqual({ ok: 1, degraded: 3, error: 0 });
  });

  test("sums rows of a day and splits days", () => {
    const days = runsByDay(
      [
        row({ errorRegions: 3, degradedOrErrorRegions: 3, runs: 2 }),
        row({ errorRegions: 3, degradedOrErrorRegions: 3, runs: 5 }),
        row({ errorRegions: 1, degradedOrErrorRegions: 4, runs: 1 }),
        row({ day: "2026-11-03T00:00:00.000Z", runs: 9 }),
      ],
      6,
    );
    expect(days.get("2026-11-02")).toEqual({ ok: 0, degraded: 1, error: 7 });
    expect(days.get("2026-11-03")).toEqual({ ok: 9, degraded: 0, error: 0 });
  });

  test("no runs or no configured regions → no entry", () => {
    expect(runsByDay([], 6).size).toBe(0);
    expect(runsByDay([row({ runs: 0 })], 6).size).toBe(0);
    expect(runsByDay([row({})], 0).size).toBe(0);
  });
});

describe("runsBy", () => {
  test("keys interval rows by the given key", () => {
    const interval = new Date("2026-11-08T12:00:00.000Z");
    expect(
      runsBy(
        [{ interval, errorRegions: 2, degradedOrErrorRegions: 2, runs: 3 }],
        4,
        (r) => r.interval.toISOString(),
      ),
    ).toEqual(
      new Map([[interval.toISOString(), { ok: 0, degraded: 0, error: 3 }]]),
    );
  });
});
