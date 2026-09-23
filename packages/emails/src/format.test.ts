import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  formatDateTime,
  formatDay,
  formatElapsed,
  formatLongDay,
  formatShortDay,
  plural,
} from "../emails/_components/format";

describe("email date formatting", () => {
  test("timestamps carry an explicit UTC suffix", () => {
    expect(formatDateTime("2026-09-18T12:37:00Z")).toBe("18 Sep, 12:37 UTC");
    expect(formatDateTime(new Date("2026-10-13T00:05:00Z"))).toBe(
      "13 Oct, 00:05 UTC",
    );
  });

  test("timestamps are rendered in UTC regardless of the offset given", () => {
    expect(formatDateTime("2026-09-18T23:30:00-02:00")).toBe(
      "19 Sep, 01:30 UTC",
    );
  });

  test("day-only dates drop the suffix", () => {
    expect(formatDay("2026-09-25T00:00:00Z")).toBe("Fri 25 Sep 2026");
    expect(formatDay("2026-09-25T00:00:00Z")).not.toContain("UTC");
    expect(formatLongDay("2026-09-25T00:00:00Z")).toBe("Friday 25 September");
    expect(formatShortDay("2026-09-25T00:00:00Z")).toBe("25 Sep");
  });

  test("unparseable input is returned as-is", () => {
    expect(formatDateTime("Mon - Tue")).toBe("Mon - Tue");
    expect(formatDay("soon")).toBe("soon");
  });

  test("elapsed time", () => {
    expect(formatElapsed("2026-09-18T10:23:00Z", "2026-09-18T12:37:00Z")).toBe(
      "2h 14m",
    );
    expect(formatElapsed("2026-09-18T10:23:00Z", "2026-09-18T10:50:00Z")).toBe(
      "27m",
    );
    expect(formatElapsed("2026-09-18T10:00:00Z", "2026-09-20T13:00:00Z")).toBe(
      "2d 3h",
    );
    expect(formatElapsed("2026-09-18T12:00:00Z", "2026-09-18T10:00:00Z")).toBe(
      "0m",
    );
  });

  test("plural", () => {
    expect(plural(1, "monitor")).toBe("1 monitor");
    expect(plural(3, "monitor")).toBe("3 monitors");
  });
});
