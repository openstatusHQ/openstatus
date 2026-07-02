import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  type ComputeCountRow,
  computeMonitorMonth,
  monthDays,
  monthRange,
  previousMonth,
} from "../compute";

const MONTH = "2026-06-01";

const row = (
  day: string,
  counts: Partial<Pick<ComputeCountRow, "ok" | "degraded" | "error">> = {},
  monitorId = "77",
): ComputeCountRow => ({
  monitorId,
  day,
  ok: counts.ok ?? 0,
  degraded: counts.degraded ?? 0,
  error: counts.error ?? 0,
});

describe("previousMonth", () => {
  test("returns the UTC first-of-month before now", () => {
    expect(previousMonth(new Date(Date.UTC(2026, 6, 10)))).toBe("2026-06-01");
    expect(previousMonth(new Date(Date.UTC(2026, 0, 10)))).toBe("2025-12-01");
  });
});

describe("monthRange", () => {
  test("spans [first-of-month, first-of-next-month) in UTC ms", () => {
    const { start, end } = monthRange(MONTH);
    expect(start).toBe(Date.UTC(2026, 5, 1));
    expect(end).toBe(Date.UTC(2026, 6, 1));
  });
});

describe("monthDays", () => {
  test("handles 31/30/28-day months and leap February", () => {
    expect(monthDays("2026-07-01").length).toBe(31);
    expect(monthDays("2026-06-01").length).toBe(30);
    expect(monthDays("2026-02-01").length).toBe(28);
    expect(monthDays("2028-02-01").length).toBe(29);
    expect(monthDays(MONTH)[0]).toBe("2026-06-01");
    expect(monthDays(MONTH)[29]).toBe("2026-06-30");
  });
});

describe("computeMonitorMonth", () => {
  test("slices ISO day strings and zero-fills missing days", () => {
    const computed = computeMonitorMonth({
      month: MONTH,
      monitorId: 77,
      counts: [
        row("2026-06-05T00:00:00.000Z", { ok: 42, degraded: 1 }),
        row("2026-06-30", { ok: 7, error: 2 }),
      ],
    });

    expect(computed).not.toBeNull();
    expect(computed?.days.length).toBe(30);
    expect(computed?.days[4]).toEqual({
      day: "2026-06-05",
      ok: 42,
      degraded: 1,
      error: 0,
    });
    expect(computed?.days[29]).toEqual({
      day: "2026-06-30",
      ok: 7,
      degraded: 0,
      error: 2,
    });
    expect(computed?.days[0]).toEqual({
      day: "2026-06-01",
      ok: 0,
      degraded: 0,
      error: 0,
    });
  });

  test("drops rows outside the month and rows of other monitors", () => {
    const computed = computeMonitorMonth({
      month: MONTH,
      monitorId: 77,
      counts: [
        row("2026-05-31", { ok: 99 }),
        row("2026-07-01", { ok: 99 }),
        row("2026-06-10", { ok: 99 }, "88"),
        row("2026-06-10", { ok: 5 }),
      ],
    });

    expect(computed?.days[9].ok).toBe(5);
    expect(computed?.days.every((d) => d.ok <= 5)).toBe(true);
  });

  test("sums multiple rows for the same day instead of overwriting", () => {
    const computed = computeMonitorMonth({
      month: MONTH,
      monitorId: 77,
      counts: [
        row("2026-06-10", { ok: 10, degraded: 1 }),
        row("2026-06-10T12:00:00.000Z", { ok: 5, error: 2 }),
      ],
    });

    expect(computed?.days[9]).toEqual({
      day: "2026-06-10",
      ok: 15,
      degraded: 1,
      error: 2,
    });
  });

  test("returns null when the monitor has no counts in the month", () => {
    expect(
      computeMonitorMonth({ month: MONTH, monitorId: 77, counts: [] }),
    ).toBeNull();
    expect(
      computeMonitorMonth({
        month: MONTH,
        monitorId: 77,
        counts: [
          row("2026-05-31", { ok: 1 }),
          row("2026-06-10", { ok: 1 }, "88"),
        ],
      }),
    ).toBeNull();
  });
});
