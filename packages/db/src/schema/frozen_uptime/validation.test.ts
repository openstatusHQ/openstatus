import { describe, expect, it } from "vitest";

import { frozenMonitorUptimeDaySchema } from "../index";

const current = {
  day: "2026-11-01",
  requests: { ok: 1712, degraded: 4, error: 12 },
  runs: { ok: 284, degraded: 1, error: 3 },
};

describe("frozenMonitorUptimeDaySchema", () => {
  it("keeps requests and runs", () => {
    expect(frozenMonitorUptimeDaySchema.parse(current)).toEqual(current);
  });

  it("rejects a day without counts", () => {
    expect(
      frozenMonitorUptimeDaySchema.safeParse({ day: "2026-11-01" }).success,
    ).toBe(false);
  });
});

describe("frozenMonitorUptimeDaySchema bad ranges", () => {
  const outage = {
    day: "2026-10-31",
    requests: { ok: 8520, degraded: 0, error: 120 },
    runs: { ok: 1420, degraded: 0, error: 20 },
    bad: {
      requests: [
        [94, 1, 0, 90],
        [95, 1, 0, 30],
      ],
      runs: [
        [94, 1, 0, 15],
        [95, 1, 0, 5],
      ],
    },
  };

  it("round-trips the ranges", () => {
    expect(frozenMonitorUptimeDaySchema.parse(outage)).toEqual(outage);
  });

  it("accepts a whole-day range", () => {
    const day = { ...current, bad: { runs: [[0, 96, 0, 15]] } };
    expect(frozenMonitorUptimeDaySchema.parse(day)).toEqual(day);
  });

  it("rejects malformed ranges", () => {
    for (const range of [
      [96, 1, 0, 1],
      [-1, 1, 0, 1],
      [95, 2, 0, 1],
      [0, 0, 0, 1],
      [0, 1, 0, -1],
      [0, 1, 0.5, 1],
      [0, 1, 0],
    ]) {
      expect(
        frozenMonitorUptimeDaySchema.safeParse({
          ...current,
          bad: { requests: [range] },
        }).success,
      ).toBe(false);
    }
  });
});
