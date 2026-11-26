import { describe, expect, it } from "vitest";

import { formatMonitorVisibility } from "./use-monitor-visibility";

describe("formatMonitorVisibility", () => {
  it("shows a placeholder while loading", () => {
    expect(formatMonitorVisibility(undefined)).toBe("-");
  });

  it("says when the monitor is on no status page", () => {
    expect(formatMonitorVisibility({ pages: 0, publicPages: 0 })).toBe(
      "Not on a status page",
    );
  });

  it("counts public pages out of all pages", () => {
    expect(formatMonitorVisibility({ pages: 1, publicPages: 1 })).toBe(
      "Public on 1 of 1 page",
    );
    expect(formatMonitorVisibility({ pages: 3, publicPages: 0 })).toBe(
      "Public on 0 of 3 pages",
    );
  });
});
