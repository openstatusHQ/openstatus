import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import { FakeTime } from "@std/testing/time";

import {
  getDateByPeriod,
  getHoursByPeriod,
  getMinutesByInterval,
  periodFormatter,
  periods,
} from "./utils";

describe("getHoursByPeriod", () => {
  test("maps each period to its hour count", () => {
    expect(periods.map(getHoursByPeriod)).toEqual([24, 168, 336]);
  });
});

describe("periodFormatter", () => {
  test("labels each period", () => {
    expect(periods.map(periodFormatter)).toEqual([
      "Last day",
      "Last 7 days",
      "Last 14 days",
    ]);
  });
});

describe("getDateByPeriod", () => {
  // mid-June, local time, so no DST transition falls inside any period
  const now = new Date(2024, 5, 15, 13, 27, 45, 123);

  function at<T>(fn: () => T) {
    const time = new FakeTime(now);
    try {
      return fn();
    } finally {
      time.restore();
    }
  }

  test("ends every period at the end of today", () => {
    for (const period of periods) {
      expect(at(() => getDateByPeriod(period)).to).toEqual(
        new Date(2024, 5, 15, 23, 59, 59, 999),
      );
    }
  });

  test("starts 1d a day before the current hour", () => {
    expect(at(() => getDateByPeriod("1d")).from).toEqual(
      new Date(2024, 5, 14, 13, 0, 0, 0),
    );
  });

  test("starts longer periods at midnight, n days back", () => {
    expect(at(() => getDateByPeriod("7d")).from).toEqual(
      new Date(2024, 5, 8, 0, 0, 0, 0),
    );
    expect(at(() => getDateByPeriod("14d")).from).toEqual(
      new Date(2024, 5, 1, 0, 0, 0, 0),
    );
  });
});

describe("getMinutesByInterval", () => {
  test("maps each periodicity to minutes", () => {
    expect(getMinutesByInterval("1m")).toBe(1);
    expect(getMinutesByInterval("5m")).toBe(5);
    expect(getMinutesByInterval("10m")).toBe(10);
    expect(getMinutesByInterval("30m")).toBe(30);
    expect(getMinutesByInterval("1h")).toBe(60);
  });

  test("rounds sub-minute and custom intervals to supported buckets", () => {
    expect(getMinutesByInterval("30s")).toBe(1);
    expect(getMinutesByInterval("other")).toBe(60);
  });
});
