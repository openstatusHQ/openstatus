import { describe, expect, it } from "vitest";

import {
  checkMarkers,
  checkSuccess,
  historyDays,
  historyMonths,
  isCheckMarker,
  type MonitorHistoryIncident,
  outageMarkers,
  sumChecks,
  utcDays,
} from "./monitor-history.client";

const now = new Date("2026-11-22T12:00:00Z");

const incident = (
  startedAt: string,
  resolvedAt: string | null,
  excusedAt: string | null = null,
) =>
  ({
    id: 1,
    startedAt: new Date(startedAt),
    resolvedAt: resolvedAt ? new Date(resolvedAt) : null,
    excusedAt: excusedAt ? new Date(excusedAt) : null,
  }) as MonitorHistoryIncident;

describe("utcDays", () => {
  it("buckets by UTC day, whatever the local zone", () => {
    const days = utcDays(
      new Date("2026-10-31T23:30:00Z"),
      new Date("2026-11-01T00:10:00Z"),
    );
    expect(days.map((d) => d.key)).toEqual(["2026-10-31", "2026-11-01"]);
    expect(days[0].date.getDate()).toBe(31);
  });
});

describe("outageMarkers", () => {
  it("puts a late-evening UTC outage on its UTC day and hatches excused ones", () => {
    const [marker] = outageMarkers(
      [incident("2026-10-31T23:30:00Z", "2026-10-31T23:50:00Z")],
      now,
    );
    expect(marker.date.getMonth()).toBe(9);
    expect(marker.date.getDate()).toBe(31);
    const [excused] = outageMarkers(
      [incident("2026-10-01T10:00:00Z", "2026-10-01T10:10:00Z", "2026-10-02")],
      now,
    );
    expect(excused).toMatchObject({ status: "empty", hatched: true });
  });
});

describe("checkMarkers", () => {
  it("marks only days with failures, red above 5%", () => {
    const markers = checkMarkers(
      [
        { day: "2026-11-01", ok: 100, degraded: 0, error: 0 },
        { day: "2026-11-02", ok: 99, degraded: 0, error: 1 },
        { day: "2026-11-03", ok: 90, degraded: 0, error: 10 },
      ],
      "requests",
    );
    expect(markers.map((m) => m.status)).toEqual(["degraded", "error"]);
    expect(markers.every(isCheckMarker)).toBe(true);
  });
});

describe("sumChecks / checkSuccess", () => {
  it("sums a month and counts degraded as up", () => {
    const sum = sumChecks(
      [
        { day: "2026-11-01", ok: 8, degraded: 1, error: 1 },
        { day: "2026-10-31", ok: 5, degraded: 0, error: 5 },
      ],
      "2026-11",
    );
    expect(sum).toEqual({ ok: 8, degraded: 1, error: 1 });
    expect(checkSuccess(sum)).toBe(90);
    expect(sumChecks([], "2026-11")).toBeNull();
  });
});

describe("historyDays", () => {
  it("splits downtime at UTC midnight and counts excused outages apart", () => {
    const day = historyDays(
      [
        incident("2026-10-31T23:30:00Z", "2026-11-01T00:30:00Z"),
        incident("2026-11-01T05:00:00Z", "2026-11-01T05:10:00Z", "2026-11-02"),
      ],
      [],
      [],
      now,
    );
    expect(day("2026-10-31").outage).toEqual({
      downtimeMs: 30 * 60_000,
      count: 1,
      excused: 0,
    });
    expect(day("2026-11-01").outage).toEqual({
      downtimeMs: 30 * 60_000,
      count: 1,
      excused: 1,
    });
  });
});

describe("historyMonths", () => {
  it("files an outage carried in from before the window under the first month", () => {
    const carried = incident("2026-08-31T23:00:00Z", "2026-09-01T01:00:00Z");
    const months = historyMonths(
      [
        {
          month: "2026-09-01",
          availability: 99.9,
          downtimeMs: 3_600_000,
          outages: 1,
        },
        { month: "2026-10-01", availability: 100, downtimeMs: 0, outages: 0 },
      ],
      [carried],
      [],
      [],
    );
    expect(months.map((m) => [m.key, m.incidents.length])).toEqual([
      ["2026-10", 0],
      ["2026-09", 1],
    ]);
  });
});
