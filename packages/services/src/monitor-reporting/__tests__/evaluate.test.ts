import { describe, expect, test } from "vitest";

import { evaluateSlaMonth, sumMonthRuns } from "../evaluate";

describe("evaluateSlaMonth", () => {
  test("a month at exactly the target is met", () => {
    expect(
      evaluateSlaMonth({
        counts: { ok: 1990, degraded: 0, error: 10 },
        target: 99_500,
        strict: false,
      }),
    ).toEqual({ total: 2000, up: 1990, met: true, uptime: 99_500 });
  });

  test("one run below the target is missed", () => {
    expect(
      evaluateSlaMonth({
        counts: { ok: 1989, degraded: 0, error: 11 },
        target: 99_500,
        strict: false,
      }),
    ).toEqual({ total: 2000, up: 1989, met: false, uptime: 99_450 });
  });

  test("zero runs has no judgement", () => {
    expect(
      evaluateSlaMonth({
        counts: { ok: 0, degraded: 0, error: 0 },
        target: 99_500,
        strict: false,
      }),
    ).toEqual({ total: 0, up: 0, met: null, uptime: null });
  });

  test("uptime is floored, so a miss never rounds up to its target", () => {
    // 99.4999...% must read 99.499, not 99.500
    const res = evaluateSlaMonth({
      counts: { ok: 198_999, degraded: 0, error: 1_001 },
      target: 99_500,
      strict: false,
    });
    expect(res.met).toBe(false);
    expect(res.uptime).toBe(99_499);
  });

  test("degraded runs count as up unless strict", () => {
    const counts = { ok: 990, degraded: 8, error: 2 };
    expect(
      evaluateSlaMonth({ counts, target: 99_500, strict: false }).met,
    ).toBe(true);
    expect(evaluateSlaMonth({ counts, target: 99_500, strict: true })).toEqual({
      total: 1000,
      up: 990,
      met: false,
      uptime: 99_000,
    });
  });

  test("excused runs leave both sides of the fraction", () => {
    expect(
      evaluateSlaMonth({
        counts: { ok: 990, degraded: 0, error: 10 },
        excused: { ok: 0, degraded: 0, error: 6 },
        target: 99_500,
        strict: false,
      }),
    ).toEqual({ total: 994, up: 990, met: true, uptime: 99_597 });
  });
});

describe("sumMonthRuns", () => {
  test("sums only the days that carry run verdicts", () => {
    expect(
      sumMonthRuns([
        {
          day: "2026-09-01",
          requests: { ok: 500, degraded: 0, error: 500 },
        },
        {
          day: "2026-09-02",
          requests: { ok: 10, degraded: 0, error: 0 },
          runs: { ok: 140, degraded: 2, error: 1 },
        },
        {
          day: "2026-09-03",
          requests: { ok: 10, degraded: 0, error: 0 },
          runs: { ok: 144, degraded: 0, error: 0 },
        },
      ]),
    ).toEqual({ ok: 284, degraded: 2, error: 1 });
  });

  test("a month without any run verdicts sums to zero", () => {
    expect(
      sumMonthRuns([
        { day: "2026-09-01", requests: { ok: 5, degraded: 0, error: 0 } },
      ]),
    ).toEqual({ ok: 0, degraded: 0, error: 0 });
  });
});
