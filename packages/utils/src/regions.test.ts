import { describe, expect, test } from "vitest";

import { statusRegions } from "./heartbeat";
import { uniqueRegions } from "./regions";

describe("uniqueRegions", () => {
  test("splits stored regions and keeps the first of each duplicate", () => {
    expect(uniqueRegions("fra,ams,fra, ams,iad")).toEqual([
      "fra",
      "ams",
      "iad",
    ]);
  });

  test("drops blanks", () => {
    expect(uniqueRegions("")).toEqual([]);
    expect(uniqueRegions(" , ")).toEqual([]);
    expect(uniqueRegions(["ams", "", "ams"])).toEqual(["ams"]);
  });
});

describe("statusRegions", () => {
  test("counts a duplicated region once", () => {
    expect(
      statusRegions({ jobType: "http", regions: ["ams", "fra", "ams"] }),
    ).toEqual(["ams", "fra"]);
  });

  test("heartbeats keep their pseudo-region", () => {
    expect(statusRegions({ jobType: "heartbeat", regions: ["ams"] })).toEqual([
      "heartbeat",
    ]);
  });
});
