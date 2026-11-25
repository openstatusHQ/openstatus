import { describe, expect, test } from "vitest";

import { HTTPMonitorSchema, MonitorSchema } from "./schema";

describe("v1 monitor regions", () => {
  test("a region sent twice is kept once, not rejected", () => {
    expect(MonitorSchema.shape.regions.parse(["ams", "fra", "ams"])).toEqual([
      "ams",
      "fra",
    ]);
    expect(HTTPMonitorSchema.shape.regions.parse(["iad", "iad"])).toEqual([
      "iad",
    ]);
  });

  test("stored comma-joined regions read once each", () => {
    expect(MonitorSchema.shape.regions.parse("ams,fra,ams")).toEqual([
      "ams",
      "fra",
    ]);
  });
});
