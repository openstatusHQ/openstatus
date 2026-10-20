import { describe, expect, it } from "vitest";

import { getMonitorHealth } from "./monitors.client";

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
});
