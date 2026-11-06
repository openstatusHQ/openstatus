import { describe, expect, it } from "vitest";

import { timeZoneSearchKeywords, timeZoneSearchScore } from "./timezone-search";

const rank = (search: string, now = new Date("2026-11-05T12:00:00Z")) =>
  Intl.supportedValuesOf("timeZone")
    .map((zone) => ({
      zone,
      score: timeZoneSearchScore(
        zone,
        search,
        timeZoneSearchKeywords(zone, now),
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ zone }) => zone);

describe("timeZoneSearchKeywords", () => {
  it("names both halves of the year", () => {
    expect(timeZoneSearchKeywords("America/Los_Angeles")).toEqual(
      expect.arrayContaining(["PST", "PDT"]),
    );
  });

  it("adds regional abbreviations other English locales use", () => {
    expect(timeZoneSearchKeywords("Europe/Berlin")).toEqual(
      expect.arrayContaining(["CET", "CEST"]),
    );
    expect(timeZoneSearchKeywords("Asia/Kolkata")).toContain("IST");
    expect(timeZoneSearchKeywords("Australia/Sydney")).toContain("AEST");
  });

  it("names a zone without DST once", () => {
    expect(timeZoneSearchKeywords("Asia/Tokyo")).toEqual(["GMT+9"]);
  });
});

describe("timeZoneSearchScore", () => {
  it("puts zones with that short name first", () => {
    expect(rank("PST")[0]).toBe("America/Los_Angeles");
    expect(rank("PST")).not.toContain("Pacific/Easter");
  });

  it("finds European zones by CET", () => {
    expect(rank("CET")).toContain("Europe/Berlin");
    expect(rank("CET")).not.toContain("America/Los_Angeles");
  });

  it("finds a zone by its summer name in winter", () => {
    expect(rank("PDT")).toContain("America/Los_Angeles");
  });

  it("ranks a city before a zone that only contains the query", () => {
    const zones = rank("berlin");
    expect(zones[0]).toBe("Europe/Berlin");
  });

  it("treats spaces as underscores", () => {
    expect(rank("los angeles")[0]).toBe("America/Los_Angeles");
  });

  it("keeps the region prefix searchable", () => {
    expect(rank("america/new")[0]).toBe("America/New_York");
  });

  it("drops scattered letter matches", () => {
    expect(timeZoneSearchScore("Pacific/Easter", "pst")).toBe(0);
  });

  it("shows everything for an empty search", () => {
    expect(timeZoneSearchScore("Asia/Tokyo", "  ")).toBe(1);
  });
});
