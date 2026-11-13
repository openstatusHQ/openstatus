import { describe, expect, test } from "vitest";

import { monthRange } from "../../frozen-uptime/compute";
import {
  completeMonths,
  canonicalTimeZone,
  isValidTimeZone,
  liveUntilFrozen,
  monthOf,
  monthsBetween,
  splitByMonth,
  timeMonth,
} from "../months";

describe("UTC month boundaries", () => {
  test("months are calendar months in UTC", () => {
    expect(monthRange("2026-10-01")).toEqual({
      start: Date.UTC(2026, 9, 1),
      end: Date.UTC(2026, 10, 1),
    });
  });

  test("the last UTC hour of a month belongs to that month", () => {
    expect(monthOf(Date.UTC(2026, 9, 31, 23, 30))).toBe("2026-10-01");
    expect(monthOf(Date.UTC(2026, 10, 1))).toBe("2026-11-01");
  });

  test("the current and complete months", () => {
    const now = new Date(Date.UTC(2026, 10, 1, 2));
    expect(monthOf(now)).toBe("2026-11-01");
    expect(completeMonths(now, 2)).toEqual(["2026-09-01", "2026-10-01"]);
  });

  test("months between two months, across a year", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
  });

  test("a window across a month boundary is split at it", () => {
    const from = Date.UTC(2026, 9, 31, 22);
    const to = Date.UTC(2026, 10, 1, 1);
    expect(splitByMonth(from, to)).toEqual([
      { month: "2026-10-01", start: from, end: Date.UTC(2026, 10, 1) },
      { month: "2026-11-01", start: Date.UTC(2026, 10, 1), end: to },
    ]);
  });

  test("the previous month is live only while its runs are kept", () => {
    expect(liveUntilFrozen("2026-10-01", new Date(Date.UTC(2026, 10, 2)))).toBe(
      true,
    );
    expect(
      liveUntilFrozen("2026-10-01", new Date(Date.UTC(2026, 10, 20))),
    ).toBe(false);
    expect(liveUntilFrozen("2026-09-01", new Date(Date.UTC(2026, 10, 2)))).toBe(
      false,
    );
  });
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("time-zoned month boundaries", () => {
  test("UTC is the default zone", () => {
    expect(monthRange("2026-03-01", "UTC")).toEqual(monthRange("2026-03-01"));
    expect(monthOf(Date.UTC(2026, 2, 31, 23), "UTC")).toBe("2026-03-01");
  });

  test("a month starts at local midnight on the 1st", () => {
    expect(monthRange("2026-01-01", "America/New_York")).toEqual({
      start: Date.UTC(2026, 0, 1, 5),
      end: Date.UTC(2026, 1, 1, 5),
    });
    expect(monthRange("2026-07-01", "Asia/Kolkata")).toEqual({
      start: Date.UTC(2026, 5, 30, 18, 30),
      end: Date.UTC(2026, 6, 31, 18, 30),
    });
    // +13:45 in southern summer, +12:45 in winter
    expect(monthRange("2026-01-01", "Pacific/Chatham").start).toBe(
      Date.UTC(2025, 11, 31, 10, 15),
    );
    expect(monthRange("2026-07-01", "Pacific/Chatham").start).toBe(
      Date.UTC(2026, 5, 30, 11, 15),
    );
  });

  test("a spring-forward month is one hour short", () => {
    const berlin = monthRange("2026-03-01", "Europe/Berlin");
    expect(berlin).toEqual({
      start: Date.UTC(2026, 1, 28, 23),
      end: Date.UTC(2026, 2, 31, 22),
    });
    expect(berlin.end - berlin.start).toBe(31 * DAY - HOUR);
    const ny = monthRange("2026-03-01", "America/New_York");
    expect(ny.end - ny.start).toBe(31 * DAY - HOUR);
  });

  test("a fall-back month is one hour long", () => {
    const berlin = monthRange("2026-10-01", "Europe/Berlin");
    expect(berlin.end - berlin.start).toBe(31 * DAY + HOUR);
    const ny = monthRange("2026-11-01", "America/New_York");
    expect(ny).toEqual({
      start: Date.UTC(2026, 10, 1, 4),
      end: Date.UTC(2026, 11, 1, 5),
    });
    expect(ny.end - ny.start).toBe(30 * DAY + HOUR);
  });

  test("the instant of local midnight belongs to the new month", () => {
    const midnight = Date.UTC(2026, 1, 28, 23); // 2026-03-01T00:00 Berlin
    expect(monthOf(midnight, "Europe/Berlin")).toBe("2026-03-01");
    expect(monthOf(midnight - 1, "Europe/Berlin")).toBe("2026-02-01");
    expect(monthOf(midnight, "UTC")).toBe("2026-02-01");
    const kolkata = Date.UTC(2026, 5, 30, 18, 30);
    expect(monthOf(kolkata, "Asia/Kolkata")).toBe("2026-07-01");
    expect(monthOf(kolkata - 1, "Asia/Kolkata")).toBe("2026-06-01");
    const chatham = Date.UTC(2025, 11, 31, 10, 15);
    expect(monthOf(chatham, "Pacific/Chatham")).toBe("2026-01-01");
    expect(monthOf(chatham - 1, "Pacific/Chatham")).toBe("2025-12-01");
  });

  test("complete months are counted in the zone", () => {
    // 2026-11-01T02:00Z is still October in New York
    const now = new Date(Date.UTC(2026, 10, 1, 2));
    expect(completeMonths(now, 2, "America/New_York")).toEqual([
      "2026-08-01",
      "2026-09-01",
    ]);
    expect(completeMonths(now, 2, "Asia/Kolkata")).toEqual([
      "2026-09-01",
      "2026-10-01",
    ]);
  });

  test("a window is split at the local month boundary", () => {
    const boundary = Date.UTC(2026, 9, 31, 23); // 2026-11-01T00:00 Berlin (CET)
    const from = boundary - 2 * HOUR;
    const to = boundary + HOUR / 2;
    expect(splitByMonth(from, to, "Europe/Berlin")).toEqual([
      { month: "2026-10-01", start: from, end: boundary },
      { month: "2026-11-01", start: boundary, end: to },
    ]);
    expect(splitByMonth(from, to)).toEqual([
      { month: "2026-10-01", start: from, end: to },
    ]);
  });

  test("the previous local month is live until frozen", () => {
    // 2026-11-01T03:00Z: November in UTC, still October in New York
    const now = new Date(Date.UTC(2026, 10, 1, 3));
    expect(liveUntilFrozen("2026-10-01", now)).toBe(true);
    expect(liveUntilFrozen("2026-10-01", now, "America/New_York")).toBe(false);
    const later = new Date(Date.UTC(2026, 10, 1, 5));
    expect(liveUntilFrozen("2026-10-01", later, "America/New_York")).toBe(true);
  });

  test("time zones are validated against Intl", () => {
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("Pacific/Chatham")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("+05:00")).toBe(false);
  });

  test("canonicalTimeZone folds aliases and rejects raw offsets", () => {
    for (const alias of [
      "UTC",
      "Etc/UTC",
      "GMT",
      "Etc/GMT",
      "Etc/UCT",
      "UCT",
      "Zulu",
      "Universal",
      "utc",
      "etc/utc",
      "gmt",
      "zulu",
    ]) {
      expect(canonicalTimeZone(alias), alias).toBe("UTC");
    }
    expect(canonicalTimeZone("europe/berlin")).toBe("Europe/Berlin");
    expect(canonicalTimeZone(" Europe/Berlin ")).toBe("Europe/Berlin");
    expect(canonicalTimeZone("US/Pacific")).toBe("America/Los_Angeles");
    expect(canonicalTimeZone("Etc/GMT+12")).toBe("Etc/GMT+12");
    for (const bad of ["+05:00", "-0800", "+05", "Mars/Olympus", ""]) {
      expect(canonicalTimeZone(bad), bad).toBeNull();
    }
  });
});

describe("timeMonth", () => {
  test("measured time always carries run counts", () => {
    // the month opens on the tail of a run from the month before
    const month = timeMonth({
      month: "2026-11-01",
      state: "live",
      episodes: [
        {
          kind: "error",
          startedAt: Date.UTC(2026, 10, 1),
          endedAt: Date.UTC(2026, 10, 1) + 30_000,
          runs: 0,
          weightedMs: 30_000,
        },
      ],
      covered: {
        start: Date.UTC(2026, 10, 1),
        end: Date.UTC(2026, 10, 1) + 30_000,
      },
      excusedSpans: [],
      terms: { target: 99_000, strict: false },
      timeZone: "UTC",
    });
    expect(month.measuredMs).toBe(30_000);
    expect(month.counts).toEqual({ ok: 0, degraded: 0, error: 1 });
    expect(month.excused).toEqual({ ok: 0, degraded: 0, error: 0 });
    expect(month.uptime).toBe(0);
  });
});
