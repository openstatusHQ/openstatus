import { describe, expect, test } from "bun:test";

import { Region } from "@openstatus/proto/monitor/v1";
import { AVAILABLE_REGIONS, RAILWAY_REGIONS } from "@openstatus/regions";

import {
  regionToString,
  regionsToStrings,
  stringToRegion,
  stringsToRegions,
  validateRegions,
} from "./regions";

describe("region converter", () => {
  describe("Railway regions", () => {
    const cases: Array<[string, Region]> = [
      ["railway_us-west2", Region.RAILWAY_US_WEST2],
      ["railway_us-east4-eqdc4a", Region.RAILWAY_US_EAST4],
      ["railway_europe-west4-drams3a", Region.RAILWAY_EUROPE_WEST4],
      ["railway_asia-southeast1-eqsg3a", Region.RAILWAY_ASIA_SOUTHEAST1],
    ];

    test.each(cases)("stringToRegion(%s) → enum", (db, proto) => {
      expect(stringToRegion(db)).toBe(proto);
    });

    test.each(cases)("regionToString(enum) → %s", (db, proto) => {
      expect(regionToString(proto)).toBe(db);
    });

    test("validateRegions accepts all Railway DB codes", () => {
      expect(validateRegions([...RAILWAY_REGIONS])).toEqual([]);
    });

    test("round-trip through proto preserves Railway DB codes", () => {
      const input = [...RAILWAY_REGIONS];
      const roundTripped = regionsToStrings(stringsToRegions(input));
      expect(roundTripped.sort()).toEqual([...input].sort());
      expect(validateRegions(roundTripped)).toEqual([]);
    });

    test("suffix-less Railway codes are not recognized", () => {
      expect(stringToRegion("railway_us-east4")).toBe(Region.UNSPECIFIED);
      expect(stringToRegion("railway_europe-west4")).toBe(Region.UNSPECIFIED);
      expect(stringToRegion("railway_asia-southeast1")).toBe(
        Region.UNSPECIFIED,
      );
    });
  });

  test("regionToString output is a valid AVAILABLE_REGIONS code for every mapped enum", () => {
    const available = new Set<string>(AVAILABLE_REGIONS);
    const enums: Region[] = [
      Region.RAILWAY_US_WEST2,
      Region.RAILWAY_US_EAST4,
      Region.RAILWAY_EUROPE_WEST4,
      Region.RAILWAY_ASIA_SOUTHEAST1,
    ];
    for (const r of enums) {
      expect(available.has(regionToString(r))).toBe(true);
    }
  });
});
