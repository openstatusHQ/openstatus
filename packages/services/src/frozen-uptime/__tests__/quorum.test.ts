import { describe, expect, test } from "vitest";

import { quorumRegionCount, runsByMonitorDay } from "../quorum";

describe("quorumRegionCount", () => {
  test("counts unique cloud regions", () => {
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

describe("runsByMonitorDay", () => {
  test("keys judged rows by monitor and YYYY-MM-DD, summing a repeated day", () => {
    const runs = runsByMonitorDay([
      {
        monitorId: "1",
        day: "2026-11-02T00:00:00.000Z",
        ok: 8,
        degraded: 1,
        error: 2,
      },
      { monitorId: "1", day: "2026-11-02", ok: 1, degraded: 0, error: 0 },
      {
        monitorId: "1",
        day: "2026-11-03T00:00:00.000Z",
        ok: 9,
        degraded: 0,
        error: 0,
      },
      {
        monitorId: "2",
        day: "2026-11-02T00:00:00.000Z",
        ok: 0,
        degraded: 0,
        error: 4,
      },
    ]);
    expect(runs.get("1")?.get("2026-11-02")).toEqual({
      ok: 9,
      degraded: 1,
      error: 2,
    });
    expect(runs.get("1")?.get("2026-11-03")).toEqual({
      ok: 9,
      degraded: 0,
      error: 0,
    });
    expect(runs.get("2")?.get("2026-11-02")).toEqual({
      ok: 0,
      degraded: 0,
      error: 4,
    });
  });

  test("a row without runs gets no entry", () => {
    expect(
      runsByMonitorDay([
        { monitorId: "1", day: "2026-11-02", ok: 0, degraded: 0, error: 0 },
      ]).size,
    ).toBe(0);
  });
});
