import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

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
