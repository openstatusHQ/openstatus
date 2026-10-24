import { describe, expect, it } from "vitest";

import { timeZoneShortName, timeZoneShortNames } from "./timezone";

describe("timeZoneShortName", () => {
  it("keeps UTC as is", () => {
    expect(timeZoneShortName("UTC")).toBe("UTC");
  });

  it("renders the locale's short name", () => {
    expect(timeZoneShortName("Asia/Tokyo")).toBe("GMT+9");
    expect(timeZoneShortName("Asia/Tokyo", "ja")).toBe("JST");
  });

  it("names the zone as of the given instant", () => {
    const winter = new Date("2026-01-15T12:00:00Z");
    const summer = new Date("2026-07-15T12:00:00Z");
    expect(timeZoneShortName("America/New_York", "en-US", winter)).toBe("EST");
    expect(timeZoneShortName("America/New_York", "en-US", summer)).toBe("EDT");
    expect(timeZoneShortName("Europe/Berlin", "en-US", winter)).toBe("GMT+1");
    expect(timeZoneShortName("Europe/Berlin", "en-US", summer)).toBe("GMT+2");
  });
});

describe("timeZoneShortNames", () => {
  it("names a span once when it stays in one offset", () => {
    const from = new Date("2026-01-15T12:00:00Z");
    const to = new Date("2026-01-15T14:00:00Z");
    expect(timeZoneShortNames("America/New_York", "en-US", [from, to])).toBe(
      "EST",
    );
  });

  it("names both ends of a span that crosses a DST change", () => {
    const from = new Date("2026-03-08T06:00:00Z");
    const to = new Date("2026-03-08T08:00:00Z");
    expect(timeZoneShortNames("America/New_York", "en-US", [from, to])).toBe(
      "EST/EDT",
    );
  });
});
