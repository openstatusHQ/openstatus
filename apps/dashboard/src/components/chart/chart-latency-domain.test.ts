import { describe, expect, it } from "vitest";

import { computeLatencyYAxisDomain } from "./chart-latency-domain";

describe("computeLatencyYAxisDomain", () => {
  it("returns dataMax when degradedAfter is null or undefined", () => {
    expect(computeLatencyYAxisDomain(500, null)).toBe(500);
    expect(computeLatencyYAxisDomain(500, undefined)).toBe(500);
  });

  it("expands to degradedAfter when dataMax < degradedAfter <= dataMax * 2", () => {
    // dataMax is 600, degradedAfter is 1000 (1000 <= 1200) -> domain is 1000 to show degraded line
    expect(computeLatencyYAxisDomain(600, 1000)).toBe(1000);
  });

  it("does not clip dataMax when actual latency exceeds degradedAfter (dataMax > degradedAfter)", () => {
    // dataMax is 1500, degradedAfter is 1000 (1000 <= 3000) -> domain must be 1500, not 1000
    expect(computeLatencyYAxisDomain(1500, 1000)).toBe(1500);
  });

  it("falls back to dataMax when degradedAfter would squash series below half height", () => {
    // dataMax is 100, degradedAfter is 1000 (1000 > 200) -> returns dataMax (100)
    expect(computeLatencyYAxisDomain(100, 1000)).toBe(100);
  });
});
