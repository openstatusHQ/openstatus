import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { dayWindow } from "../day-window";
import {
  type Event,
  fillStatusDataFor45Days,
  fillStatusDataFor45DaysNoop,
  isDateWithinEvent,
  reportEventDayImpact,
  resolveDayStatus,
  type StatusData,
} from "../events";
import { probeDowntimeIntervals } from "../uptime";

const at = (iso: string) => new Date(iso);
const ms = (iso: string) => at(iso).getTime();

function incident(from: string, to: string): Event {
  return {
    id: 1,
    name: "incident",
    from: at(from),
    to: at(to),
    type: "incident",
    status: "error",
  };
}

function bucket(date: string, overrides: Partial<StatusData> = {}): StatusData {
  return {
    day: `${date}T00:00:00.000Z`,
    count: 1,
    ok: 1,
    degraded: 0,
    error: 0,
    monitorId: "1",
    ...overrides,
  };
}

describe("fillStatusDataFor45Days in a time zone", () => {
  // 2026-10-16 05:00 in Tokyo, still 2026-10-15 in UTC
  beforeEach(() => {
    vi.useFakeTimers({ now: at("2026-10-15T20:00:00.000Z") });
  });
  afterEach(() => vi.useRealTimers());

  test("ends on today's date in the zone", () => {
    expect(fillStatusDataFor45Days([], "1", 45, "Asia/Tokyo").at(-1)?.day).toBe(
      "2026-10-16T00:00:00.000Z",
    );
    expect(fillStatusDataFor45Days([], "1", 45).at(-1)?.day).toBe(
      "2026-10-15T00:00:00.000Z",
    );
  });

  // the 15m endpoints return 45 days back from local midnight, so every
  // past day listed is complete
  test("starts 44 days before today's date in the zone", () => {
    const filled = fillStatusDataFor45Days([], "1", 45, "Asia/Tokyo");
    expect(filled).toHaveLength(45);
    expect(filled[0].day).toBe("2026-09-02T00:00:00.000Z");
  });

  test("keeps the rows of the zone's dates", () => {
    const filled = fillStatusDataFor45Days(
      [bucket("2026-10-16", { error: 3 })],
      "1",
      45,
      "Asia/Tokyo",
    );
    expect(filled.at(-1)?.error).toBe(3);
  });

  test("lines the synthetic days up with the zone's dates", () => {
    const filled = fillStatusDataFor45DaysNoop({
      errorDays: [0],
      degradedDays: [],
      timeZone: "Asia/Tokyo",
    });
    expect(filled.at(-1)).toMatchObject({
      day: "2026-10-16T00:00:00.000Z",
      error: 1,
    });
  });
});

describe("matching events to a day in a time zone", () => {
  // 01:00-01:30 in Tokyo on 2026-10-16, still 2026-10-15 in UTC
  const early = incident(
    "2026-10-15T16:00:00.000Z",
    "2026-10-15T16:30:00.000Z",
  );
  const tokyo = (date: string) => dayWindow(date, "Asia/Tokyo");

  test("puts an event on the zone's date", () => {
    expect(isDateWithinEvent(tokyo("2026-10-16"), early)).toBe(true);
    expect(isDateWithinEvent(tokyo("2026-10-15"), early)).toBe(false);
    expect(isDateWithinEvent(dayWindow("2026-10-15"), early)).toBe(true);
  });

  test("keeps the 25th hour of the day summer time ends on that day", () => {
    // 23:30-23:45 in Berlin on 2026-10-25
    const late = incident(
      "2026-10-25T22:30:00.000Z",
      "2026-10-25T22:45:00.000Z",
    );
    const berlin = (date: string) => dayWindow(date, "Europe/Berlin");
    expect(isDateWithinEvent(berlin("2026-10-25"), late)).toBe(true);
    expect(isDateWithinEvent(berlin("2026-10-26"), late)).toBe(false);
  });

  test("reads report impacts on the zone's date", () => {
    const report: Event = {
      ...early,
      type: "report",
      impactIntervals: [
        { from: early.from, to: early.to, impact: "major_outage" },
      ],
    };
    expect(reportEventDayImpact(report, tokyo("2026-10-16"))).toBe(
      "major_outage",
    );
    expect(reportEventDayImpact(report, tokyo("2026-10-15"))).toBe(
      "operational",
    );
  });

  test("resolves the day status on the zone's date", () => {
    expect(
      resolveDayStatus(bucket("2026-10-16"), [early], "Asia/Tokyo").status,
    ).toBe("down");
    expect(resolveDayStatus(bucket("2026-10-16"), [early]).status).toBe(
      "operational",
    );
  });
});

describe("probeDowntimeIntervals in a time zone", () => {
  test("spans the zone's day", () => {
    const intervals = probeDowntimeIntervals(
      [bucket("2026-10-16", { ok: 0, error: 1 })],
      { start: 0, end: Number.MAX_SAFE_INTEGER, now: 0 },
      "Asia/Tokyo",
    );
    expect(intervals).toEqual([
      {
        from: ms("2026-10-15T15:00:00.000Z"),
        to: ms("2026-10-16T15:00:00.000Z"),
        weight: 1,
      },
    ]);
  });
});
