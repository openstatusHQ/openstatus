import { describe, expect, it } from "vitest";

import {
  exampleUptimeCounts,
  formatUptime,
  quorumNote,
  quorumSince,
  uptimeYears,
} from "./uptime-history.client";

const now = new Date(Date.UTC(2026, 10, 4, 12)); // Wednesday

describe("uptimeYears", () => {
  it("returns nothing until a day has checks", () => {
    expect(uptimeYears([], null, now)).toEqual([]);
    expect(
      uptimeYears(
        [{ day: "2026-10-01", ok: 0, degraded: 0, error: 0 }],
        null,
        now,
      ),
    ).toEqual([]);
  });

  it("one full grid per year, newest first", () => {
    const years = uptimeYears(
      [
        { day: "2025-03-10", ok: 0, degraded: 0, error: 0 },
        { day: "2025-03-11", ok: 90, degraded: 5, error: 5 },
        { day: "2026-11-02", ok: 100, degraded: 0, error: 0 },
      ],
      null,
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
      null,
      now,
    );
    const on = (d: number) =>
      year.days.find(
        (x) => x.date.getTime() === new Date(2026, 10, d).getTime(),
      );
    expect(on(1)).toMatchObject({
      level: 0,
      lines: ["100.00% uptime", "100 checks"],
    });
    expect(year.days[0].blank).toBe(true);
    expect(on(2)).toMatchObject({ hatched: true, lines: ["No checks"] });
    expect(on(3)).toMatchObject({
      level: 2,
      lines: ["97.00% uptime", "100 checks · 3 failed"],
    });
    expect(on(5)?.scale).toBeUndefined();
  });

  it("degraded checks count as up", () => {
    const [year] = uptimeYears(
      [{ day: "2026-11-02", ok: 90, degraded: 10, error: 0 }],
      null,
      now,
    );
    expect(year.uptime).toBe(1);
    expect(year.failedDays).toBe(0);
    expect(
      year.days.find((d) => d.date.getDate() === 2 && d.date.getMonth() === 10),
    ).toMatchObject({
      level: 0,
      lines: ["100.00% uptime", "100 checks · 10 degraded"],
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
      null,
      now,
    );
    const levels = year.days.filter((d) => d.level).map((d) => d.level);
    expect(levels).toEqual([1, 2, 2, 3]);
    expect(year.failedDays).toBe(4);
  });

  it("a year without checks after the first one has no uptime", () => {
    const years = uptimeYears(
      [{ day: "2024-12-31", ok: 10, degraded: 0, error: 0 }],
      null,
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
      null,
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
      null,
      now,
    );
    expect(year.uptime).toBe(1);
    expect(year.failedDays).toBe(0);
  });
});

describe("uptimeYears in runs", () => {
  const quorum = {
    regionCount: 6,
    buckets: [
      { errorRegions: 0, notOkRegions: 0, runs: 95 },
      { errorRegions: 3, notOkRegions: 3, runs: 5 },
    ],
  };

  it("converts days without a histogram so the year sums one unit", () => {
    const [year] = uptimeYears(
      [
        { day: "2026-10-31", ok: 540, degraded: 0, error: 60 },
        { day: "2026-11-01", ok: 585, degraded: 0, error: 15, quorum },
      ],
      6,
      now,
    );
    expect(year.uptime).toBe((90 + 95) / 200);
    const on = (m: number, d: number) =>
      year.days.find(
        (x) => x.date.getTime() === new Date(2026, m, d).getTime(),
      );
    expect(on(9, 31)?.lines).toEqual([
      "90.00% uptime",
      "100 checks · 10 failed",
    ]);
    expect(on(10, 1)?.lines).toEqual([
      "95.00% uptime",
      "100 checks · 5 failed",
    ]);
  });

  it("rounds converted counts at display", () => {
    const [year] = uptimeYears(
      [{ day: "2026-11-02", ok: 595, degraded: 1, error: 4 }],
      6,
      now,
    );
    expect(
      year.days.find((d) => d.date.getDate() === 2 && d.date.getMonth() === 10)
        ?.lines,
    ).toEqual(["99.33% uptime", "100 checks · 1 failed"]);
  });

  it("without a population ignores the histogram and counts region checks", () => {
    const [year] = uptimeYears(
      [{ day: "2026-11-01", ok: 585, degraded: 0, error: 15, quorum }],
      null,
      now,
    );
    expect(year.uptime).toBe(585 / 600);
  });
});

describe("quorumSince", () => {
  const days = [
    { day: "2026-10-31", ok: 1, degraded: 0, error: 0 },
    {
      day: "2026-11-01",
      ok: 1,
      degraded: 0,
      error: 0,
      quorum: { regionCount: 6, buckets: [] },
    },
  ];

  it("is the first day with a histogram, only for monitors counted in runs", () => {
    expect(quorumSince(days, 6)).toEqual(new Date(2026, 10, 1));
    expect(quorumSince(days, null)).toBeNull();
  });

  it("the note says how earlier checks are counted", () => {
    expect(quorumNote(new Date(2026, 10, 1))).toBe(
      "Since November 2026, a check covers all of the monitor's regions and counts as down when at least half of them fail. Earlier checks are region results divided by the number of regions.",
    );
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
