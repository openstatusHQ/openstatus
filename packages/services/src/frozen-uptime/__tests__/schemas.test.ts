import { frozenMonitorUptimeDaySchema } from "@openstatus/db/src/schema";
import { describe, expect, test } from "vitest";

import { FreezeMonitorMonthInput } from "../schemas";

const valid: FreezeMonitorMonthInput = {
  monitorId: 1,
  month: "2026-06-01",
  days: [{ day: "2026-06-01", ok: 10, degraded: 1, error: 0 }],
};

describe("FreezeMonitorMonthInput", () => {
  test("accepts a valid row", () => {
    expect(FreezeMonitorMonthInput.parse(valid)).toEqual(valid);
  });

  test("rejects a month that is not first-of-month", () => {
    expect(() =>
      FreezeMonitorMonthInput.parse({ ...valid, month: "2026-06-15" }),
    ).toThrow();
    expect(() =>
      FreezeMonitorMonthInput.parse({ ...valid, month: "2026-06" }),
    ).toThrow();
  });

  test("rejects malformed days", () => {
    expect(() =>
      FreezeMonitorMonthInput.parse({
        ...valid,
        days: [{ day: "2026-06-01", ok: 0 }],
      }),
    ).toThrow();
    expect(() =>
      FreezeMonitorMonthInput.parse({
        ...valid,
        days: [{ day: "2026-06-01T00:00:00Z", ok: 0, degraded: 0, error: 0 }],
      }),
    ).toThrow();
    expect(() =>
      FreezeMonitorMonthInput.parse({
        ...valid,
        days: [{ day: "2026-06-01", ok: -1, degraded: 0, error: 0 }],
      }),
    ).toThrow();
  });
});

describe("frozenMonitorUptimeDaySchema", () => {
  const oldDay = { day: "2026-06-01", ok: 10, degraded: 1, error: 2 };
  const quorum = {
    regionCount: 6,
    buckets: [
      { errorRegions: 0, notOkRegions: 0, runs: 1430 },
      { errorRegions: 3, notOkRegions: 4, runs: 10 },
    ],
  };

  test("accepts a day without a quorum histogram", () => {
    expect(frozenMonitorUptimeDaySchema.parse(oldDay)).toEqual(oldDay);
  });

  test("accepts a day with a quorum histogram", () => {
    const day = { ...oldDay, quorum };
    expect(frozenMonitorUptimeDaySchema.parse(day)).toEqual(day);
    expect(
      FreezeMonitorMonthInput.parse({ ...valid, days: [day] }).days[0].quorum,
    ).toEqual(quorum);
  });

  test("rejects a quorum without a positive region count or with bad buckets", () => {
    expect(() =>
      frozenMonitorUptimeDaySchema.parse({
        ...oldDay,
        quorum: { ...quorum, regionCount: 0 },
      }),
    ).toThrow();
    expect(() =>
      frozenMonitorUptimeDaySchema.parse({
        ...oldDay,
        quorum: {
          regionCount: 6,
          buckets: [{ errorRegions: -1, notOkRegions: 0, runs: 1 }],
        },
      }),
    ).toThrow();
  });
});
