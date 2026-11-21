import {
  formatChartDateTime,
  formatChartTick,
  toLatencyRegionRows,
} from "@openstatus/ui/lib/chart-latency";
import { describe, expect, it } from "vitest";

describe("toLatencyRegionRows", () => {
  it("keys each series by position and keeps gaps as null", () => {
    expect(
      toLatencyRegionRows(
        [1000, 2000],
        [
          { region: "fra", values: [300, null] },
          { region: "My Office", values: [200] },
        ],
      ),
    ).toEqual([
      { timestamp: 1000, s0: 300, s1: 200 },
      { timestamp: 2000, s0: null, s1: null },
    ]);
  });
});

describe("chart formatting", () => {
  const utc = { timeZone: "UTC" };
  const noon = Date.UTC(2026, 8, 8, 12);
  const midnight = Date.UTC(2026, 8, 8, 0);
  const halfPast = Date.UTC(2026, 8, 8, 16, 30);

  it("labels 1d ticks by time and its midnight by date", () => {
    const day = { timeRange: "1d", intervalMinutes: 60 };
    expect(formatChartTick(noon, day, utc)).toBe("12:00 PM");
    expect(formatChartTick(midnight, day, utc)).toBe("Sep 8");
  });

  it("labels longer ranges by date and hour, adding minutes only when set", () => {
    const week = { timeRange: "7d", intervalMinutes: 240 };
    expect(formatChartTick(noon, week, utc)).toBe("Sep 8, 12 PM");
    expect(formatChartTick(halfPast, week, utc)).toBe("Sep 8, 4:30 PM");
    expect(
      formatChartTick(noon, { timeRange: "90d", intervalMinutes: 1440 }, utc),
    ).toBe("Sep 8");
  });

  it("follows the given locale and time zone", () => {
    expect(formatChartDateTime(noon, utc)).toBe("September 8 at 12:00 PM");
    expect(
      formatChartDateTime(noon, { locale: "de-DE", timeZone: "Europe/Berlin" }),
    ).toBe("8. September um 14:00");
  });
});
