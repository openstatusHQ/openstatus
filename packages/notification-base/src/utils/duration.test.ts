import { describe, it, expect } from "bun:test";
import { formatDuration, calculateDuration } from "./duration";

describe("formatDuration", () => {
  it("formats short durations (seconds only)", () => {
    expect(formatDuration(30000)).toBe("30s");
  });

  it("formats medium durations (minutes and seconds)", () => {
    expect(formatDuration(135000)).toBe("2m 15s");
  });

  it("formats long durations (hours, minutes, seconds)", () => {
    expect(formatDuration(8130000)).toBe("2h 15m 30s");
  });

  it("formats very long durations (days and hours)", () => {
    expect(formatDuration(90000000)).toBe("1d 1h");
  });

  it("handles 0ms", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("handles negative values", () => {
    expect(formatDuration(-1000)).toBe("0s");
  });

  it("handles sub-second durations", () => {
    expect(formatDuration(500)).toBe("0s");
  });

  it("respects maxUnits option", () => {
    expect(formatDuration(90061000, { maxUnits: 2 })).toBe("1d 1h");
    expect(formatDuration(90061000, { maxUnits: 1 })).toBe("1d");
  });

  it("only shows non-zero units", () => {
    expect(formatDuration(3600000)).toBe("1h");
    expect(formatDuration(60000)).toBe("1m");
    expect(formatDuration(86400000)).toBe("1d");
  });
});

describe("calculateDuration", () => {
  it("calculates duration between two dates", () => {
    const start = new Date("2026-01-22T10:00:00Z");
    const end = new Date("2026-01-22T12:15:30Z");
    expect(calculateDuration(start, end)).toBe(8130000);
  });

  it("handles same start and end", () => {
    const date = new Date("2026-01-22T10:00:00Z");
    expect(calculateDuration(date, date)).toBe(0);
  });
});
