import { describe, expect, it } from "vitest";

import { selectMonitorSchema } from "../index";

const regions = selectMonitorSchema.shape.regions;

describe("selectMonitorSchema regions", () => {
  it("reads each stored region once, in first-seen order", () => {
    expect(regions.parse("fra,ams,fra,ams,iad")).toEqual(["fra", "ams", "iad"]);
  });

  it("reads no regions from an empty column", () => {
    expect(regions.parse("")).toEqual([]);
  });
});
