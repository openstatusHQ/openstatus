import { describe, expect, it } from "vitest";

import { compareMonitorHealth, getMonitorHealth } from "./monitors.client";

describe("getMonitorHealth", () => {
  it("follows the last check while active", () => {
    expect(getMonitorHealth({ active: true, status: "active" })).toBe("active");
    expect(getMonitorHealth({ active: true, status: "error" })).toBe("error");
    expect(getMonitorHealth({ active: true, status: "degraded" })).toBe(
      "degraded",
    );
  });

  it("reads as inactive when paused, whatever the last check said", () => {
    expect(getMonitorHealth({ active: false, status: "error" })).toBe(
      "inactive",
    );
    expect(getMonitorHealth({ active: null, status: "active" })).toBe(
      "inactive",
    );
  });

  it("reads as maintenance over the held status, but not when paused", () => {
    const maintenance = { until: new Date() };
    expect(
      getMonitorHealth({ active: true, status: "error", maintenance }),
    ).toBe("maintenance");
    expect(
      getMonitorHealth({ active: false, status: "active", maintenance }),
    ).toBe("inactive");
  });
});

const monitor = (
  name: string,
  over: Partial<{
    active: boolean;
    status: "active" | "degraded" | "error";
    maintenance: { until: Date } | null;
  }> = {},
) => ({
  name,
  active: true,
  status: "active" as const,
  maintenance: null,
  ...over,
});

describe("compareMonitorHealth", () => {
  it("orders down, degraded, maintenance, normal, paused, then by name", () => {
    const sorted = [
      monitor("paused", { active: false, status: "error" }),
      monitor("b-normal"),
      monitor("maintenance", { maintenance: { until: new Date() } }),
      monitor("a-normal"),
      monitor("degraded", { status: "degraded" }),
      monitor("down", { status: "error" }),
    ].sort(compareMonitorHealth);
    expect(sorted.map((m) => m.name)).toEqual([
      "down",
      "degraded",
      "maintenance",
      "a-normal",
      "b-normal",
      "paused",
    ]);
  });
});
