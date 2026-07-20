import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { blacklistDates, isInBlacklist } from "./blacklist";

describe("isInBlacklist", () => {
  it("returns the stored reason for a blacklisted day", () => {
    const key = "Fri Aug 25 2023";
    expect(isInBlacklist(new Date(key))).toBe(blacklistDates[key]);
  });

  it("returns undefined for a day that is not blacklisted", () => {
    expect(isInBlacklist(new Date("2024-01-01T12:00:00.000Z"))).toBeUndefined();
  });
});
