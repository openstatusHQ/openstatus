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
