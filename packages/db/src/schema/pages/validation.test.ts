import { describe, expect, it } from "vitest";

import { selectPageSchema, timeZoneSchema } from "../index";

describe("timeZoneSchema", () => {
  it("accepts IANA zone names", () => {
    for (const zone of ["UTC", "Asia/Tokyo", "Asia/Kolkata"]) {
      expect(timeZoneSchema.parse(zone)).toBe(zone);
    }
  });

  it("rejects offsets and names that are not zones", () => {
    for (const value of ["Mars/Olympus", "", "+09:00"]) {
      expect(timeZoneSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("selectPageSchema defaultTimezone", () => {
  const defaultTimezone = selectPageSchema.shape.defaultTimezone;

  it("falls back to UTC when the stored zone cannot be resolved", () => {
    expect(defaultTimezone.parse("Asia/Tokyo")).toBe("Asia/Tokyo");
    expect(defaultTimezone.parse("Mars/Olympus")).toBe("UTC");
  });
});
