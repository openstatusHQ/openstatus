import { describe, expect, it } from "vitest";

import {
  exampleUptimeCounts,
  formatUptime,
  uptimeYears,
} from "./uptime-history.client";

const now = new Date(Date.UTC(2026, 10, 4, 12)); // Wednesday

describe("uptimeYears", () => {
  it("returns nothing until a day has checks", () => {
    expect(uptimeYears([], now)).toEqual([]);
    expect(
      uptimeYears([{ day: "2026-10-01", ok: 0, degraded: 0, error: 0 }], now),
    ).toEqual([]);
  });

  it("one full grid per year, newest first", () => {
    const years = uptimeYears(
      [
        { day: "2025-03-10", ok: 0, degraded: 0, error: 0 },
        { day: "2025-03-11", ok: 90, degraded: 5, error: 5 },
        { day: "2026-11-02", ok: 100, degraded: 0, error: 0 },
      ],
      now,
    );
    expect(years.map((y) => y.year)).toEqual([2026, 2025]);
    expect(years[0].days.at(-1)).toEqual({ date: new Date(2026, 11, 31) });
    expect(years[1].days).toHaveLength(365);
    expect(years[1].uptime).toBe(0.95);
    expect(years[1].failedDays).toBe(1);
  });

  it("blank before the first check, hatched for gaps, muted without failures", () => {
    const [year] = uptimeYears(
      [
        { day: "2026-11-01", ok: 100, degraded: 0, error: 0 },
        { day: "2026-11-03", ok: 97, degraded: 0, error: 3 },
      ],
      now,
    );
    const on = (d: number) =>
      year.days.find(
        (x) => x.date.getTime() === new Date(2026, 10, d).getTime(),
      );
    expect(on(1)).toMatchObject({
      level: 0,
      lines: ["100.00% uptime", "100 requests"],
    });
    expect(year.days[0].blank).toBe(true);
    expect(on(2)).toMatchObject({ hatched: true, lines: ["No requests"] });
    expect(on(3)).toMatchObject({
      level: 2,
      lines: ["97.00% uptime", "100 requests · 3 failed"],
    });
    expect(on(5)?.scale).toBeUndefined();
  });

  it("labels counts in runs, singular for one", () => {
    const [year] = uptimeYears(
      [
        { day: "2026-11-01", ok: 1, degraded: 0, error: 0 },
        { day: "2026-11-02", ok: 140, degraded: 0, error: 4 },
      ],
      now,
      "runs",
    );
    const on = (d: number) =>
      year.days.find(
        (x) => x.date.getTime() === new Date(2026, 10, d).getTime(),
      );
    expect(on(1)?.lines?.[1]).toBe("1 run");
    expect(on(2)?.lines?.[1]).toBe("144 runs · 4 failed");
  });

  it("degraded checks count as up", () => {
    const [year] = uptimeYears(
      [{ day: "2026-11-02", ok: 90, degraded: 10, error: 0 }],
      now,
    );
    expect(year.uptime).toBe(1);
    expect(year.failedDays).toBe(0);
    expect(
      year.days.find((d) => d.date.getDate() === 2 && d.date.getMonth() === 10),
    ).toMatchObject({
      level: 0,
      lines: ["100.00% uptime", "100 requests · 10 degraded"],
    });
  });

  it("failure level by failed share: < 1%, ≤ 5%, > 5%", () => {
    const [year] = uptimeYears(
      [
        { day: "2026-11-01", ok: 999, degraded: 0, error: 1 },
        { day: "2026-11-02", ok: 99, degraded: 0, error: 1 },
        { day: "2026-11-03", ok: 95, degraded: 0, error: 5 },
        { day: "2026-11-04", ok: 94, degraded: 0, error: 6 },
      ],
      now,
    );
    const levels = year.days.filter((d) => d.level).map((d) => d.level);
    expect(levels).toEqual([1, 2, 2, 3]);
    expect(year.failedDays).toBe(4);
  });

  it("a year without checks after the first one has no uptime", () => {
    const years = uptimeYears(
      [{ day: "2024-12-31", ok: 10, degraded: 0, error: 0 }],
      now,
    );
    expect(years.map((y) => y.year)).toEqual([2026, 2025, 2024]);
    expect(years[1].uptime).toBeNull();
    expect(years[1].days.every((d) => d.hatched)).toBe(true);
  });

  it("today is the UTC day, whatever the local time zone", () => {
    // 23:30 UTC: already the 5th east of UTC, still the 4th in UTC
    const late = new Date(Date.UTC(2026, 10, 4, 23, 30));
    const [year] = uptimeYears(
      [{ day: "2026-11-04", ok: 10, degraded: 0, error: 0 }],
      late,
    );
    const on = (d: number) =>
      year.days.find(
        (x) => x.date.getTime() === new Date(2026, 10, d).getTime(),
      );
    expect(on(4)).toMatchObject({ level: 0 });
    expect(on(5)).toEqual({ date: new Date(2026, 10, 5) });
  });

  it("ignores counts dated after now", () => {
    const [year] = uptimeYears(
      [
        { day: "2026-11-01", ok: 10, degraded: 0, error: 0 },
        { day: "2026-11-20", ok: 0, degraded: 0, error: 10 },
      ],
      now,
    );
    expect(year.uptime).toBe(1);
    expect(year.failedDays).toBe(0);
  });
});

describe("exampleUptimeCounts", () => {
  it("is stable and spans from last January to today", () => {
    const counts = exampleUptimeCounts(now);
    expect(exampleUptimeCounts(now)).toEqual(counts);
    expect(counts[0].day).toBe("2025-01-01");
    expect(counts.at(-1)?.day).toBe("2026-11-04");
    for (const c of counts) {
      expect(c.ok + c.degraded + c.error).toBe(1440);
    }
  });
});

describe("formatUptime", () => {
  it("truncates instead of rounding up", () => {
    expect(formatUptime(0.999999, 3)).toBe("99.999%");
    expect(formatUptime(0.99995)).toBe("99.99%");
  });

  it("does not under-report exact ratios through float error", () => {
    expect(formatUptime(0.57)).toBe("57.00%");
    expect(formatUptime(624 / 625)).toBe("99.84%");
  });

  it("pads whole numbers", () => {
    expect(formatUptime(1)).toBe("100.00%");
    expect(formatUptime(0)).toBe("0.00%");
  });
});
