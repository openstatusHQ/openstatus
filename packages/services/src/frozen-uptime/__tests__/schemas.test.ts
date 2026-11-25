import { frozenMonitorUptimeDaySchema } from "@openstatus/db/src/schema";
import { describe, expect, test } from "vitest";

import { FreezeMonitorMonthInput } from "../schemas";

const valid: FreezeMonitorMonthInput = {
  monitorId: 1,
  month: "2026-06-01",
  days: [{ day: "2026-06-01", requests: { ok: 10, degraded: 1, error: 0 } }],
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
        days: [{ day: "2026-06-01", requests: { ok: 0 } }],
      }),
    ).toThrow();
    expect(() =>
      FreezeMonitorMonthInput.parse({
        ...valid,
        days: [
          {
            day: "2026-06-01T00:00:00Z",
            requests: { ok: 0, degraded: 0, error: 0 },
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      FreezeMonitorMonthInput.parse({
        ...valid,
        days: [
          { day: "2026-06-01", requests: { ok: -1, degraded: 0, error: 0 } },
        ],
      }),
    ).toThrow();
  });
});

describe("frozenMonitorUptimeDaySchema", () => {
  const requests = { ok: 10, degraded: 1, error: 2 };
  const runs = { ok: 1430, degraded: 0, error: 10 };

  test("accepts a day without runs", () => {
    const day = { day: "2026-06-01", requests };
    expect(frozenMonitorUptimeDaySchema.parse(day)).toEqual(day);
  });

  test("accepts a day with runs", () => {
    const day = { day: "2026-06-01", requests, runs };
    expect(frozenMonitorUptimeDaySchema.parse(day)).toEqual(day);
    expect(
      FreezeMonitorMonthInput.parse({ ...valid, days: [day] }).days[0].runs,
    ).toEqual(runs);
  });

  test("rejects negative runs", () => {
    expect(() =>
      frozenMonitorUptimeDaySchema.parse({
        day: "2026-06-01",
        requests,
        runs: { ...runs, error: -1 },
      }),
    ).toThrow();
  });
});
