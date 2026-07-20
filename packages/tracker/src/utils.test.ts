import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { endOfDay, isSameDay, startOfDay } from "./utils";

describe("startOfDay", () => {
  it("returns midnight UTC of the given day", () => {
    expect(startOfDay(new Date("2026-03-15T14:30:45.123Z")).toISOString()).toBe(
      "2026-03-15T00:00:00.000Z",
    );
  });

  it("does not mutate the input date", () => {
    const input = new Date("2026-03-15T14:30:45.123Z");
    startOfDay(input);
    expect(input.toISOString()).toBe("2026-03-15T14:30:45.123Z");
  });
});

describe("endOfDay", () => {
  it("returns the last millisecond of the day in UTC", () => {
    expect(endOfDay(new Date("2026-03-15T00:00:00.000Z")).toISOString()).toBe(
      "2026-03-15T23:59:59.999Z",
    );
  });
});

describe("isSameDay", () => {
  it("is true for two times on the same UTC day", () => {
    expect(
      isSameDay(
        new Date("2026-03-15T00:00:00.000Z"),
        new Date("2026-03-15T23:59:59.999Z"),
      ),
    ).toBe(true);
  });

  it("is false across a UTC midnight boundary", () => {
    expect(
      isSameDay(
        new Date("2026-03-15T23:59:59.999Z"),
        new Date("2026-03-16T00:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
