import { describe, expect, it } from "vitest";

import { toLatencyRegionRows } from "./chart-line-latency-regions.data";

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
