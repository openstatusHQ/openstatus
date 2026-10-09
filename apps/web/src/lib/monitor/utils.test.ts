import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

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
  test("covers the period's hours and ends at the end of today", () => {
    for (const period of periods) {
      const { from, to } = getDateByPeriod(period);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      expect(to.getTime()).toBe(end.getTime());
      const hours = (to.getTime() - from.getTime()) / 3_600_000;
      expect(hours).toBeGreaterThanOrEqual(getHoursByPeriod(period));
      expect(hours).toBeLessThanOrEqual(getHoursByPeriod(period) + 49);
    }
  });

  test("starts 1d on an hour boundary and longer periods at midnight", () => {
    expect(getDateByPeriod("1d").from.getMinutes()).toBe(0);
    for (const period of ["7d", "14d"] as const) {
      const { from } = getDateByPeriod(period);
      expect([from.getHours(), from.getMinutes()]).toEqual([0, 0]);
    }
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
