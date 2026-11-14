import { describe, expect, test } from "vitest";

import {
  formatSlaCreditPct,
  formatSlaUptime,
  sameCreditSchedule,
  slaCredit,
} from "./constants";

describe("formatSlaUptime", () => {
  test.each([
    [99_450, "99.450"],
    [100_000, "100.000"],
    [99_499, "99.499"],
    [5, "0.005"],
  ])("%i reads %s", (uptime, expected) => {
    expect(formatSlaUptime(uptime)).toBe(expected);
  });
});

const schedule = { stepPct: 0.25, creditPct: 3, capPct: 100 };
const DAY = 86_400_000;

describe("slaCredit", () => {
  test("a month at 99.12% under 99.5% is two steps below target: 6%", () => {
    expect(
      slaCredit({ up: 9_912, total: 10_000, target: 99_500, schedule }),
    ).toEqual({ steps: 2, pct: 6 });
  });

  test("a started step counts as a full one, from the exact figure, not the floored display", () => {
    // one millisecond over the 0.5% allowance of a 30-day month
    expect(
      slaCredit({
        up: 30 * DAY - 12_960_001,
        total: 30 * DAY,
        target: 99_500,
        schedule,
      }),
    ).toEqual({ steps: 1, pct: 3 });
  });

  test("a shortfall of exactly one step is one step", () => {
    expect(
      slaCredit({ up: 9_925, total: 10_000, target: 99_500, schedule }),
    ).toEqual({ steps: 1, pct: 3 });
  });

  test("uptime exactly at target is met and earns nothing", () => {
    expect(
      slaCredit({ up: 995, total: 1_000, target: 99_500, schedule }),
    ).toEqual({ steps: 0, pct: 0 });
  });

  test("the credit stops at the cap", () => {
    expect(
      slaCredit({
        up: 1,
        total: 2,
        target: 99_500,
        schedule: { stepPct: 0.25, creditPct: 3, capPct: 25 },
      }),
    ).toEqual({ steps: 198, pct: 25 });
  });

  test("fractional percentages stay exact", () => {
    expect(
      slaCredit({
        up: 989,
        total: 1_000,
        target: 99_900,
        schedule: { stepPct: 0.1, creditPct: 0.1, capPct: 50 },
      }),
    ).toEqual({ steps: 10, pct: 1 });
  });

  test("no judgement or no schedule earns no credit", () => {
    expect(slaCredit({ up: 0, total: 0, target: 99_500, schedule })).toBeNull();
    expect(
      slaCredit({ up: 1, total: 2, target: 99_500, schedule: null }),
    ).toBeNull();
  });
});

describe("sameCreditSchedule", () => {
  test("compares by value, null only equals null", () => {
    expect(sameCreditSchedule(schedule, { ...schedule })).toBe(true);
    expect(sameCreditSchedule(schedule, { ...schedule, capPct: 50 })).toBe(
      false,
    );
    expect(sameCreditSchedule(schedule, null)).toBe(false);
    expect(sameCreditSchedule(null, null)).toBe(true);
  });
});

describe("formatSlaCreditPct", () => {
  test.each([
    [3, "3.000"],
    [0.3, "0.300"],
    [100, "100.000"],
  ])("%d reads %s", (pct, expected) => {
    expect(formatSlaCreditPct(pct)).toBe(expected);
  });
});
