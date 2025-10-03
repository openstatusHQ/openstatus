import { beforeEach, describe, expect, test } from "bun:test";
import type { z } from "zod";
import type { monitorRegionSchema } from "../src/schema/constants";
import { updateRegion } from "./region-migration";

// Import the types we need

describe("updateRegion", () => {
  let regions: z.infer<typeof monitorRegionSchema>[];

  beforeEach(() => {
    // Reset regions array before each test
    regions = ["ams", "hkg", "fra", "lax"];
  });

  describe("when old region exists in array", () => {
    test("should replace old region with 'sin' when new region does not exist in array", () => {
      updateRegion("hkg", "sin", regions);

      expect(regions).toEqual(["ams", "sin", "fra", "lax"]);
      expect(regions).toHaveLength(4);
    });

    test("should remove old region when new region already exists in array", () => {
      updateRegion("hkg", "ams", regions);

      expect(regions).toEqual(["ams", "fra", "lax"]);
      expect(regions).toHaveLength(3);
    });

    test("should handle replacing first element", () => {
      updateRegion("ams", "sin", regions);

      expect(regions).toEqual(["sin", "hkg", "fra", "lax"]);
    });

    test("should handle replacing last element", () => {
      updateRegion("lax", "sin", regions);

      expect(regions).toEqual(["ams", "hkg", "fra", "sin"]);
    });

    test("should handle case where old and new region are the same", () => {
      updateRegion("hkg", "hkg", regions);

      // Since hkg exists, it should be removed (newRegionIndex !== -1)
      expect(regions).toEqual(["ams", "fra", "lax"]);
      expect(regions).toHaveLength(3);
    });
  });

  describe("when old region does not exist in array", () => {
    test("should not modify the array when old region is not found", () => {
      const originalRegions = [...regions];
      updateRegion("sin", "syd", regions);

      expect(regions).toEqual(originalRegions);
      expect(regions).toHaveLength(4);
    });
  });

  describe("edge cases", () => {
    test("should handle empty regions array", () => {
      const emptyRegions: z.infer<typeof monitorRegionSchema>[] = [];
      updateRegion("hkg", "sin", emptyRegions);

      expect(emptyRegions).toEqual([]);
      expect(emptyRegions).toHaveLength(0);
    });

    test("should handle single element array - replace scenario", () => {
      const singleRegion: z.infer<typeof monitorRegionSchema>[] = ["hkg"];
      updateRegion("hkg", "sin", singleRegion);

      expect(singleRegion).toEqual(["sin"]);
    });

    test("should handle single element array - remove scenario", () => {
      const singleRegion: z.infer<typeof monitorRegionSchema>[] = ["hkg"];
      updateRegion("hkg", "hkg", singleRegion);

      expect(singleRegion).toEqual([]);
    });

    test("should handle array with duplicate regions", () => {
      const duplicateRegions: z.infer<typeof monitorRegionSchema>[] = [
        "ams",
        "hkg",
        "ams",
        "fra",
      ];
      updateRegion("hkg", "sin", duplicateRegions);

      // Should only replace the first occurrence of hkg
      expect(duplicateRegions).toEqual(["ams", "sin", "ams", "fra"]);
    });

    test("should handle multiple occurrences of old region", () => {
      const multipleOldRegions: z.infer<typeof monitorRegionSchema>[] = [
        "hkg",
        "ams",
        "hkg",
        "fra",
      ];
      updateRegion("hkg", "sin", multipleOldRegions);

      // Should only replace the first occurrence
      expect(multipleOldRegions).toEqual(["sin", "ams", "hkg", "fra"]);
    });

    describe("function mutates original array", () => {
      test("should modify the original regions array reference", () => {
        const originalReference = regions;
        updateRegion("hkg", "sin", regions);

        // Should be the same reference (mutated)
        expect(regions).toBe(originalReference);
        expect(regions).toEqual(["ams", "sin", "fra", "lax"]);
      });
    });

    describe("full migrations", () => {
      test("should modify the original regions array reference", () => {
        const newRegions = [
          "ams",
          "arn",
          "atl",
          "bog",
          "bom",
          "bos",
          "cdg",
          "den",
          "dfw",
          "ewr",
          "eze",
          "fra",
          "gdl",
          "gig",
          "gru",
          "hkg",
          "iad",
          "jnb",
          "lax",
          "lhr",
          "mad",
          "mia",
          "nrt",
          "ord",
          "otp",
          "phx",
          "qro",
          "sin",
          "scl",
          "sjc",
          "sea",
          "sin",
          "syd",
          "waw",
          "yul",
          "yyz",
        ] as z.infer<typeof monitorRegionSchema>[];
        // Asia Pacific
        updateRegion("hkg", "sin", newRegions);

        // North America
        updateRegion("atl", "dfw", newRegions);
        updateRegion("mia", "dfw", newRegions);
        updateRegion("gdl", "dfw", newRegions);
        updateRegion("qro", "dfw", newRegions);
        updateRegion("bos", "ewr", newRegions);
        updateRegion("phx", "lax", newRegions);
        updateRegion("sea", "sjc", newRegions);
        updateRegion("yul", "yyz", newRegions);

        // Europe
        updateRegion("waw", "ams", newRegions);
        updateRegion("mad", "cdg", newRegions);
        updateRegion("otp", "fra", newRegions);

        // South America
        updateRegion("bog", "gru", newRegions);
        updateRegion("gig", "gru", newRegions);
        updateRegion("scl", "gru", newRegions);
        updateRegion("eze", "gru", newRegions);

        // Should be the same reference (mutated)

        expect(newRegions).toEqual([
          "ams",
          "arn",
          "bom",
          "cdg",
          "den",
          "dfw",
          "ewr",
          "fra",
          "gru",
          "iad",
          "jnb",
          "lax",
          "lhr",
          "nrt",
          "ord",
          "sin",
          "sjc",
          "sin",
          "syd",
          "yyz",
        ]);
      });
    });
  });
});
