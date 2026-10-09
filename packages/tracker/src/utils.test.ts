import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { isInBlacklist } from "./blacklist";
import { endOfDay, isSameDay, startOfDay } from "./utils";

describe("startOfDay", () => {
  test("truncates to UTC midnight", () => {
    expect(startOfDay(new Date("2024-03-10T17:45:12.345Z")).toISOString()).toBe(
      "2024-03-10T00:00:00.000Z",
    );
  });

  test("does not mutate its input", () => {
    const input = new Date("2024-03-10T17:45:12.345Z");
    startOfDay(input);
    expect(input.toISOString()).toBe("2024-03-10T17:45:12.345Z");
  });
});

describe("endOfDay", () => {
  test("extends to the last UTC millisecond", () => {
    expect(endOfDay(new Date("2024-03-10T00:00:00.000Z")).toISOString()).toBe(
      "2024-03-10T23:59:59.999Z",
    );
  });

  test("handles a leap day", () => {
    expect(endOfDay(new Date("2024-02-29T12:00:00Z")).toISOString()).toBe(
      "2024-02-29T23:59:59.999Z",
    );
  });
});

describe("isSameDay", () => {
  test("matches the first and last millisecond of a UTC day", () => {
    expect(
      isSameDay(
        new Date("2024-03-10T00:00:00.000Z"),
        new Date("2024-03-10T23:59:59.999Z"),
      ),
    ).toBe(true);
  });

  test("splits across UTC midnight", () => {
    expect(
      isSameDay(
        new Date("2024-03-10T23:59:59.999Z"),
        new Date("2024-03-11T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  test("compares in UTC regardless of the input offset", () => {
    expect(
      isSameDay(
        new Date("2024-03-10T23:30:00-05:00"),
        new Date("2024-03-11T04:30:00Z"),
      ),
    ).toBe(true);
  });
});

describe("isInBlacklist", () => {
  test("returns undefined for a normal day", () => {
    expect(isInBlacklist(new Date("2024-01-01T12:00:00Z"))).toBeUndefined();
  });
});
