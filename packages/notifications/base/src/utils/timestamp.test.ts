import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { formatTimestamp } from "./timestamp";

describe("formatTimestamp", () => {
  it("formats a valid epoch timestamp as an ISO string", () => {
    expect(formatTimestamp(1700000000000)).toBe("2023-11-14T22:13:20.000Z");
  });

  it("formats timestamps before the unix epoch", () => {
    expect(formatTimestamp(-1000)).toBe("1969-12-31T23:59:59.000Z");
  });

  it("returns Unknown for 0, since it is falsy", () => {
    expect(formatTimestamp(0)).toBe("Unknown");
  });

  it("returns Unknown for NaN", () => {
    expect(formatTimestamp(Number.NaN)).toBe("Unknown");
  });

  it("returns Unknown for non finite values", () => {
    expect(formatTimestamp(Number.POSITIVE_INFINITY)).toBe("Unknown");
    expect(formatTimestamp(Number.NEGATIVE_INFINITY)).toBe("Unknown");
  });

  it("returns Unknown when the timestamp is beyond the maximum valid date", () => {
    // The largest date JS can represent is 8.64e15 ms; one past it is invalid.
    expect(formatTimestamp(8.64e15 + 1)).toBe("Unknown");
  });
});
