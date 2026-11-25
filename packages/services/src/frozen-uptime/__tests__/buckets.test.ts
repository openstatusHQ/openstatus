import type { FrozenMonitorUptimeDay } from "@openstatus/db/src/schema";
import { describe, expect, test } from "vitest";

import {
  type LocalDayCount,
  rangesInBuckets,
  toLocalDays,
  toRanges,
} from "../buckets";

describe("toRanges", () => {
  test("no failing buckets, no ranges", () => {
    expect(toRanges([])).toEqual([]);
  });

  test("merges consecutive buckets with identical counts", () => {
    expect(
      toRanges([
        { bucket: 10, degraded: 0, error: 6 },
        { bucket: 11, degraded: 0, error: 6 },
        { bucket: 12, degraded: 0, error: 6 },
        { bucket: 13, degraded: 1, error: 6 },
        { bucket: 15, degraded: 1, error: 6 },
      ]),
    ).toEqual([
      [10, 3, 0, 6],
      [13, 1, 1, 6],
      [15, 1, 1, 6],
    ]);
  });

  test("a monitor down all day is one range", () => {
    const rows = Array.from({ length: 96 }, (_, bucket) => ({
      bucket,
      degraded: 0,
      error: 15,
    }));
    expect(toRanges(rows)).toEqual([[0, 96, 0, 15]]);
  });

  test("an outage ending mid-bucket keeps the partial bucket separate", () => {
    expect(
      toRanges([
        { bucket: 94, degraded: 0, error: 90 },
        { bucket: 95, degraded: 0, error: 30 },
      ]),
    ).toEqual([
      [94, 1, 0, 90],
      [95, 1, 0, 30],
    ]);
  });

  test("sorts unsorted input", () => {
    expect(
      toRanges([
        { bucket: 5, degraded: 2, error: 0 },
        { bucket: 3, degraded: 2, error: 0 },
        { bucket: 4, degraded: 2, error: 0 },
        { bucket: 0, degraded: 0, error: 1 },
      ]),
    ).toEqual([
      [0, 1, 0, 1],
      [3, 3, 2, 0],
    ]);
  });

  test("sums duplicate rows of the same bucket", () => {
    expect(
      toRanges([
        { bucket: 7, degraded: 1, error: 0 },
        { bucket: 7, degraded: 0, error: 2 },
      ]),
    ).toEqual([[7, 1, 1, 2]]);
  });
});

describe("rangesInBuckets", () => {
  const ranges = [
    [10, 3, 0, 6],
    [13, 1, 1, 6],
    [94, 2, 2, 0],
  ] as [number, number, number, number][];

  test("whole day sums everything", () => {
    expect(rangesInBuckets(ranges, 0, 96)).toEqual({ degraded: 5, error: 24 });
  });

  test("counts only the part of a range inside [from, to)", () => {
    expect(rangesInBuckets(ranges, 11, 13)).toEqual({ degraded: 0, error: 12 });
  });

  test("excludes `to` and includes `from`", () => {
    expect(rangesInBuckets(ranges, 13, 14)).toEqual({ degraded: 1, error: 6 });
    expect(rangesInBuckets(ranges, 0, 10)).toEqual({ degraded: 0, error: 0 });
    expect(rangesInBuckets(ranges, 95, 96)).toEqual({ degraded: 2, error: 0 });
  });

  test("empty window", () => {
    expect(rangesInBuckets(ranges, 12, 12)).toEqual({ degraded: 0, error: 0 });
  });
});

describe("toLocalDays", () => {
  const counts = (days: LocalDayCount[]) =>
    days.map(({ covered: _, ...d }) => d);

  // 10 checks per quarter-hour
  const quiet = (day: string): FrozenMonitorUptimeDay => ({
    day,
    requests: { ok: 960, degraded: 0, error: 0 },
  });

  test("a 23:30 UTC outage lands in the next Berlin day and month", () => {
    const days: FrozenMonitorUptimeDay[] = [
      quiet("2026-10-30"),
      {
        day: "2026-10-31",
        requests: { ok: 940, degraded: 0, error: 20 },
        bad: { requests: [[94, 2, 0, 10]] },
      },
    ];
    expect(counts(toLocalDays(days, "Europe/Berlin", "requests"))).toEqual([
      { day: "2026-10-30", ok: 920, degraded: 0, error: 0 },
      { day: "2026-10-31", ok: 960, degraded: 0, error: 0 },
      { day: "2026-11-01", ok: 20, degraded: 0, error: 20 },
    ]);
  });

  test("a 30-minute offset splits at 18:30 UTC", () => {
    const days: FrozenMonitorUptimeDay[] = [
      {
        day: "2026-06-10",
        requests: { ok: 950, degraded: 0, error: 10 },
        bad: { requests: [[73, 2, 0, 5]] },
      },
    ];
    expect(counts(toLocalDays(days, "Asia/Kolkata", "requests"))).toEqual([
      { day: "2026-06-10", ok: 735, degraded: 0, error: 5 },
      { day: "2026-06-11", ok: 215, degraded: 0, error: 5 },
    ]);
  });

  test("a 45-minute offset splits at 18:15 UTC", () => {
    const days: FrozenMonitorUptimeDay[] = [
      {
        day: "2026-06-10",
        requests: { ok: 954, degraded: 6, error: 0 },
        bad: { requests: [[72, 2, 3, 0]] },
      },
    ];
    expect(counts(toLocalDays(days, "Asia/Kathmandu", "requests"))).toEqual([
      { day: "2026-06-10", ok: 727, degraded: 3, error: 0 },
      { day: "2026-06-11", ok: 227, degraded: 3, error: 0 },
    ]);
  });

  test("the spring-forward day is 23 local hours long", () => {
    const days = ["2026-03-28", "2026-03-29", "2026-03-30"].map(quiet);
    expect(counts(toLocalDays(days, "Europe/Berlin", "requests"))).toEqual([
      { day: "2026-03-28", ok: 920, degraded: 0, error: 0 },
      { day: "2026-03-29", ok: 920, degraded: 0, error: 0 },
      { day: "2026-03-30", ok: 960, degraded: 0, error: 0 },
      { day: "2026-03-31", ok: 80, degraded: 0, error: 0 },
    ]);
  });

  test("a day that only failed gains no passing checks", () => {
    const days: FrozenMonitorUptimeDay[] = [
      {
        day: "2026-10-31",
        requests: { ok: 0, degraded: 0, error: 4 },
        bad: { requests: [[92, 4, 0, 1]] },
      },
    ];
    expect(counts(toLocalDays(days, "Europe/Berlin", "requests"))).toEqual([
      { day: "2026-10-31", ok: 0, degraded: 0, error: 0 },
      { day: "2026-11-01", ok: 0, degraded: 0, error: 4 },
    ]);
  });

  test("a sparse monitor with clustered failures keeps its day total", () => {
    // hourly checks: 20 passed, 4 failed inside the last UTC hour
    const days: FrozenMonitorUptimeDay[] = [
      {
        day: "2026-10-31",
        requests: { ok: 20, degraded: 0, error: 4 },
        bad: { requests: [[92, 4, 0, 1]] },
      },
    ];
    const local = toLocalDays(days, "Europe/Berlin", "requests");
    const sum = (key: "ok" | "error") =>
      local.reduce((total, d) => total + d[key], 0);
    expect(sum("ok")).toBeCloseTo(20);
    expect(sum("error")).toBe(4);
    expect(counts(local)[1]).toEqual({
      day: "2026-11-01",
      ok: 0,
      degraded: 0,
      error: 4,
    });
  });

  test("a row frozen without ranges splits its checks, failures stay on the main day", () => {
    const days: FrozenMonitorUptimeDay[] = [
      { day: "2026-10-31", requests: { ok: 960, degraded: 0, error: 20 } },
    ];
    expect(counts(toLocalDays(days, "Europe/Berlin", "requests"))).toEqual([
      { day: "2026-10-31", ok: 920, degraded: 0, error: 20 },
      { day: "2026-11-01", ok: 40, degraded: 0, error: 0 },
    ]);
  });

  test("regroups the runs measure and skips days without runs", () => {
    const days: FrozenMonitorUptimeDay[] = [
      quiet("2026-10-30"),
      {
        day: "2026-10-31",
        requests: { ok: 960, degraded: 0, error: 0 },
        runs: { ok: 94, degraded: 0, error: 2 },
        bad: { runs: [[94, 2, 0, 1]] },
      },
    ];
    expect(counts(toLocalDays(days, "Europe/Berlin", "runs"))).toEqual([
      { day: "2026-10-31", ok: 92, degraded: 0, error: 0 },
      { day: "2026-11-01", ok: 2, degraded: 0, error: 2 },
    ]);
  });
  test("an edge day covers only the hours its UTC day reaches", () => {
    const local = toLocalDays(
      [quiet("2026-10-31")],
      "Europe/Berlin",
      "requests",
    );
    expect(local.map((d) => d.covered)).toEqual([
      {
        start: Date.parse("2026-10-31T00:00:00.000Z"),
        end: Date.parse("2026-10-31T23:00:00.000Z"),
      },
      {
        start: Date.parse("2026-10-31T23:00:00.000Z"),
        end: Date.parse("2026-11-01T00:00:00.000Z"),
      },
    ]);
  });

  test("a local day covered by both its UTC days has no partial span", () => {
    const days = ["2026-10-30", "2026-10-31"].map(quiet);
    const local = toLocalDays(days, "Europe/Berlin", "requests");
    expect(local.find((d) => d.day === "2026-10-31")?.covered).toBeUndefined();
  });
});
