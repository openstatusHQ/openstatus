import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import type { Event } from "../events";
import {
  type UptimeWindow,
  durationDowntimeMs,
  floorPct,
  reportsOnlyDowntimeMs,
  requestsTally,
} from "../uptime";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const base = Date.UTC(2026, 5, 10);
const window: UptimeWindow = {
  start: base,
  end: base + 10 * DAY,
  now: base + 10 * DAY,
};

function incident(fromMs: number, toMs: number | null): Event {
  return {
    id: 1,
    name: "incident",
    from: new Date(fromMs),
    to: toMs === null ? null : new Date(toMs),
    type: "incident",
    status: "error",
  };
}

function impactReport(
  fromMs: number,
  toMs: number,
  impact: "major_outage" | "partial_outage" | "degraded_performance",
): Event {
  return {
    id: 2,
    name: "report",
    from: new Date(fromMs),
    to: new Date(toMs),
    type: "report",
    status: "error",
    impactIntervals: [{ from: new Date(fromMs), to: new Date(toMs), impact }],
  };
}

function legacyReport(fromMs: number, toMs: number): Event {
  return {
    id: 3,
    name: "legacy",
    from: new Date(fromMs),
    to: new Date(toMs),
    type: "report",
    status: "degraded",
  };
}

describe("floorPct", () => {
  test("floors instead of rounding — one failed check never shows 100.00", () => {
    expect(floorPct(99_999 / 100_000)).toBe(99.99);
    expect(floorPct(1)).toBe(100);
    expect(floorPct(0)).toBe(0);
  });
});

describe("requestsTally", () => {
  test("degraded counts as up, error does not", () => {
    expect(
      requestsTally([
        { ok: 90, degraded: 5, error: 5 },
        { ok: 100, degraded: 0, error: 0 },
      ]),
    ).toEqual({ up: 195, total: 200 });
  });

  test("empty input is a zero tally", () => {
    expect(requestsTally([])).toEqual({ up: 0, total: 0 });
  });
});

describe("durationDowntimeMs", () => {
  test("incident counts at full weight", () => {
    expect(durationDowntimeMs([incident(base, base + 2 * HOUR)], window)).toBe(
      2 * HOUR,
    );
  });

  test("incident + major report describing the same outage count once", () => {
    const events = [
      incident(base, base + 2 * HOUR),
      impactReport(base, base + 2 * HOUR, "major_outage"),
    ];
    expect(durationDowntimeMs(events, window)).toBe(2 * HOUR);
  });

  test("partial outage weighs 0.5; overlapping major wins per slice", () => {
    expect(
      durationDowntimeMs(
        [impactReport(base, base + 2 * HOUR, "partial_outage")],
        window,
      ),
    ).toBe(1 * HOUR);
    // overlapping partial must not add on top of major (max, not sum)
    expect(
      durationDowntimeMs(
        [
          impactReport(base, base + 2 * HOUR, "major_outage"),
          impactReport(base, base + 2 * HOUR, "partial_outage"),
        ],
        window,
      ),
    ).toBe(2 * HOUR);
  });

  test("degraded_performance weighs 0 and legacy reports are ignored", () => {
    expect(
      durationDowntimeMs(
        [
          impactReport(base, base + 2 * HOUR, "degraded_performance"),
          legacyReport(base, base + 2 * HOUR),
        ],
        window,
      ),
    ).toBe(0);
  });

  test("coverage clips downtime inside check gaps", () => {
    const coverage = [
      { start: base, end: base + 2 * DAY },
      { start: base + 8 * DAY, end: base + 10 * DAY },
    ];
    // outage entirely inside the uncovered gap (paused monitor) → no downtime
    expect(
      durationDowntimeMs(
        [incident(base + 3 * DAY, base + 7 * DAY)],
        window,
        coverage,
      ),
    ).toBe(0);
    // outage spanning covered and uncovered time counts only the covered part
    expect(
      durationDowntimeMs(
        [incident(base + DAY, base + 9 * DAY)],
        window,
        coverage,
      ),
    ).toBe(2 * DAY);
  });

  test("events are clamped to the window; open events close at now", () => {
    // straddles the window start: only the inside part counts
    expect(
      durationDowntimeMs([incident(base - DAY, base + HOUR)], window),
    ).toBe(1 * HOUR);
    // still-open incident: closed at `now`
    expect(durationDowntimeMs([incident(base + 9 * DAY, null)], window)).toBe(
      1 * DAY,
    );
    // fully outside the window: nothing
    expect(
      durationDowntimeMs([incident(base - 2 * DAY, base - DAY)], window),
    ).toBe(0);
  });
});

describe("reportsOnlyDowntimeMs", () => {
  test("empty impactIntervals falls through to the legacy path, not zero downtime", () => {
    // getEvents emits [] for a report member the updates never impacted
    const report: Event = {
      ...legacyReport(base, base + 2 * HOUR),
      impactIntervals: [],
    };
    expect(reportsOnlyDowntimeMs([report], window)).toBe(2 * HOUR);
    // duration math keeps ignoring legacy-shaped reports
    expect(durationDowntimeMs([report], window)).toBe(0);
  });

  test("incidents are ignored, legacy reports count full duration", () => {
    const events = [
      incident(base, base + 5 * HOUR),
      legacyReport(base + 6 * HOUR, base + 8 * HOUR),
    ];
    expect(reportsOnlyDowntimeMs(events, window)).toBe(2 * HOUR);
  });

  test("impact reports stay weighted", () => {
    expect(
      reportsOnlyDowntimeMs(
        [impactReport(base, base + 4 * HOUR, "partial_outage")],
        window,
      ),
    ).toBe(2 * HOUR);
  });
});
