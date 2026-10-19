import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { timeZoneShortName } from "./timezone";

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
