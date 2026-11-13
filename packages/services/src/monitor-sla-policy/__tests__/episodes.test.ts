import { describe, expect, test } from "vitest";

import {
  type Episode,
  type Verdict,
  cutExcused,
  episodesFromRuns,
  evaluateSlaPeriod,
  slaBudget,
} from "../episodes";
import fixture from "./fixtures/episodes.json";

type Case = {
  name: string;
  input: {
    fromMs: number;
    toMs: number;
    fallbackIntervalMs: number;
    runs: { cronTimestamp: number; verdict: Verdict }[];
  };
  expected: Episode[];
};

const cases = fixture.cases as Case[];
const byName = (name: string) => {
  const c = cases.find((x) => x.name === name);
  if (!c) throw new Error(`missing fixture case ${name}`);
  return c;
};

const MIN = 60_000;
const HOUR = 60 * MIN;

describe("episodesFromRuns fixture", () => {
  test.each(cases.map((c) => [c.name, c] as const))("%s", (_, c) => {
    expect(episodesFromRuns(c.input)).toEqual(c.expected);
  });

  test.each(cases.map((c) => [c.name, c] as const))(
    "%s tiles the range exactly",
    (_, c) => {
      const eps = episodesFromRuns(c.input);
      expect(eps[0]?.startedAt).toBe(c.input.fromMs);
      expect(eps.at(-1)?.endedAt).toBe(c.input.toMs);
      for (let i = 1; i < eps.length; i++) {
        expect(eps[i].startedAt).toBe(eps[i - 1].endedAt);
        expect(eps[i].kind).not.toBe(eps[i - 1].kind);
      }
      const runs = eps.reduce((s, e) => s + e.runs, 0);
      expect(runs).toBe(c.input.runs.length);
    },
  );

  test("the fixture covers the named scenarios", () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
  });
});

describe("episodesFromRuns", () => {
  test("a 1h outage costs the same down time before and after a frequency switch", () => {
    const eps = episodesFromRuns(byName("switch-30s-to-10m").input);
    const errors = eps.filter((e) => e.kind === "error");
    expect(errors.map((e) => e.weightedMs)).toEqual([HOUR, HOUR]);
    expect(errors.map((e) => e.runs)).toEqual([120, 6]);
    expect(eps.some((e) => e.kind === "unmeasured")).toBe(false);
  });

  test("a 2h pause in a 30s cadence is about 2h unmeasured", () => {
    const eps = episodesFromRuns(byName("pause-2h").input);
    const unmeasured = eps
      .filter((e) => e.kind === "unmeasured")
      .reduce((s, e) => s + e.weightedMs, 0);
    expect(unmeasured).toBe(2 * HOUR - 30_000);
  });

  test("ignores runs outside the range and is order-independent", () => {
    const c = byName("error-burst");
    const runs = [
      { cronTimestamp: c.input.fromMs - MIN, verdict: "error" as const },
      ...[...c.input.runs].reverse(),
      { cronTimestamp: c.input.toMs, verdict: "error" as const },
    ];
    expect(episodesFromRuns({ ...c.input, runs })).toEqual(c.expected);
  });

  test("a duplicated run counts once with its worst verdict", () => {
    const c = byName("steady-30s");
    const runs = [
      ...c.input.runs,
      {
        cronTimestamp: c.input.runs[0].cronTimestamp,
        verdict: "error" as const,
      },
    ];
    expect(episodesFromRuns({ ...c.input, runs })).toEqual([
      {
        kind: "error",
        startedAt: c.input.fromMs,
        endedAt: c.input.fromMs + 30_000,
        runs: 1,
        weightedMs: 30_000,
      },
      {
        kind: "ok",
        startedAt: c.input.fromMs + 30_000,
        endedAt: c.input.toMs,
        runs: 9,
        weightedMs: 270_000,
      },
    ]);
  });

  test("an empty range has no episodes", () => {
    expect(
      episodesFromRuns({
        runs: [],
        fromMs: 1000,
        toMs: 1000,
        fallbackIntervalMs: MIN,
      }),
    ).toEqual([]);
  });
});

describe("cutExcused", () => {
  const eps = episodesFromRuns(byName("degraded-mixed").input);
  const from = byName("degraded-mixed").input.fromMs;

  test("no spans keeps everything", () => {
    expect(cutExcused(eps, [])).toEqual({ kept: eps, excused: [] });
  });

  test("splits episodes at span edges, ms-precise", () => {
    const span = { start: from + 150_000 + 1, end: from + 330_000 };
    const { kept, excused } = cutExcused(eps, [span]);
    expect(
      excused.map((e) => [e.kind, e.startedAt - from, e.endedAt - from]),
    ).toEqual([
      ["degraded", 150_001, 300_000],
      ["error", 300_000, 330_000],
    ]);
    expect(
      kept.map((e) => [e.kind, e.startedAt - from, e.endedAt - from]),
    ).toEqual([
      ["ok", 0, 120_000],
      ["degraded", 120_000, 150_001],
      ["error", 330_000, 360_000],
      ["ok", 360_000, 600_000],
    ]);
    const total = (xs: Episode[]) => xs.reduce((s, e) => s + e.weightedMs, 0);
    expect(total(kept) + total(excused)).toBe(total(eps));
    const runs = (xs: Episode[]) => xs.reduce((s, e) => s + e.runs, 0);
    expect(runs(kept) + runs(excused)).toBe(runs(eps));
  });

  test("prorated weights floor and give the remainder to the last piece", () => {
    const odd: Episode = {
      kind: "error",
      startedAt: 0,
      endedAt: 3,
      runs: 1,
      weightedMs: 10,
    };
    const { kept, excused } = cutExcused([odd], [{ start: 1, end: 2 }]);
    expect(kept.map((e) => e.weightedMs)).toEqual([3, 4]);
    expect(excused.map((e) => e.weightedMs)).toEqual([3]);
    expect([...kept, ...excused].reduce((s, e) => s + e.runs, 0)).toBe(1);
  });

  test("overlapping and unsorted spans excuse time once", () => {
    const { excused } = cutExcused(eps, [
      { start: from + 400_000, end: from + 500_000 },
      { start: from + 350_000, end: from + 450_000 },
      { start: from + 900_000, end: from + 800_000 },
    ]);
    expect(
      excused.map((e) => [e.kind, e.startedAt - from, e.endedAt - from]),
    ).toEqual([
      ["error", 350_000, 360_000],
      ["ok", 360_000, 500_000],
    ]);
  });
});

describe("evaluateSlaPeriod", () => {
  const c = byName("degraded-mixed");
  const episodes = episodesFromRuns(c.input);
  const coveredMs = c.input.toMs - c.input.fromMs;

  test("strict counts degraded time as down", () => {
    expect(
      evaluateSlaPeriod({
        episodes,
        excusedSpans: [],
        target: 60_000,
        strict: true,
        coveredMs,
      }),
    ).toEqual({
      measuredMs: 600_000,
      downMs: 240_000,
      excusedMs: 0,
      unmeasuredMs: 0,
      uptime: 60_000,
      met: true,
      coverage: 100_000,
    });
  });

  test("lenient counts degraded time as up", () => {
    const res = evaluateSlaPeriod({
      episodes,
      excusedSpans: [],
      target: 90_000,
      strict: false,
      coveredMs,
    });
    expect(res.downMs).toBe(60_000);
    expect(res.uptime).toBe(90_000);
    expect(res.met).toBe(true);
  });

  test("one ms below the target is missed and uptime floors", () => {
    const eps: Episode[] = [
      {
        kind: "ok",
        startedAt: 0,
        endedAt: 199_999,
        runs: 1,
        weightedMs: 199_999,
      },
      {
        kind: "error",
        startedAt: 199_999,
        endedAt: 200_000,
        runs: 1,
        weightedMs: 1,
      },
    ];
    const res = evaluateSlaPeriod({
      episodes: eps,
      excusedSpans: [],
      target: 100_000,
      strict: true,
      coveredMs: 200_000,
    });
    expect(res.met).toBe(false);
    expect(res.uptime).toBe(99_999);
  });

  test("excused time leaves measured and coverage", () => {
    const res = evaluateSlaPeriod({
      episodes,
      excusedSpans: [
        { start: c.input.fromMs + 300_000, end: c.input.fromMs + 360_000 },
      ],
      target: 99_000,
      strict: false,
      coveredMs,
    });
    expect(res).toMatchObject({
      measuredMs: 540_000,
      downMs: 0,
      excusedMs: 60_000,
      uptime: 100_000,
      met: true,
      coverage: 100_000,
    });
  });

  test("unmeasured time lowers coverage, not uptime", () => {
    const p = byName("tail-gap");
    const res = evaluateSlaPeriod({
      episodes: episodesFromRuns(p.input),
      excusedSpans: [],
      target: 80_000,
      strict: false,
      coveredMs: p.input.toMs - p.input.fromMs,
    });
    expect(res).toEqual({
      measuredMs: 600_000,
      downMs: 60_000,
      excusedMs: 0,
      unmeasuredMs: 3_540_000,
      uptime: 90_000,
      met: true,
      coverage: Math.floor((600_000 * 100_000) / 4_140_000),
    });
  });

  test("nothing measured has no judgement", () => {
    const p = byName("no-runs");
    const res = evaluateSlaPeriod({
      episodes: episodesFromRuns(p.input),
      excusedSpans: [],
      target: 99_000,
      strict: false,
      coveredMs: HOUR,
    });
    expect(res).toEqual({
      measuredMs: 0,
      downMs: 0,
      excusedMs: 0,
      unmeasuredMs: HOUR,
      uptime: null,
      met: null,
      coverage: 0,
    });
  });

  test("a fully excused period has no coverage", () => {
    const p = byName("no-runs");
    const res = evaluateSlaPeriod({
      episodes: episodesFromRuns(p.input),
      excusedSpans: [{ start: p.input.fromMs, end: p.input.toMs }],
      target: 99_000,
      strict: false,
      coveredMs: HOUR,
    });
    expect(res.coverage).toBeNull();
    expect(res.excusedMs).toBe(HOUR);
  });
});

describe("slaBudget", () => {
  const DAY = 24 * HOUR;
  const monthMs = 30 * DAY;

  test("99.9% of a 30 day month is 43.2 minutes, paced from 13 days", () => {
    expect(
      slaBudget({
        monthMs,
        excusedMs: 0,
        target: 99_900,
        downMs: 10 * MIN,
        elapsedMs: 13 * DAY,
      }),
    ).toEqual({
      budgetMs: 2_592_000,
      burnedMs: 10 * MIN,
      leftMs: 1_992_000,
      paceMs: Math.floor((10 * MIN * 30) / 13),
    });
  });

  test("excused time shrinks the budget and left may go negative", () => {
    const res = slaBudget({
      monthMs,
      excusedMs: 10 * DAY,
      target: 99_900,
      downMs: HOUR,
      elapsedMs: 20 * DAY,
    });
    expect(res.budgetMs).toBe(1_728_000);
    expect(res.leftMs).toBe(1_728_000 - HOUR);
  });

  test("pace stays exact beyond 2^53 intermediates", () => {
    const res = slaBudget({
      monthMs: 31 * DAY,
      excusedMs: 0,
      target: 0,
      downMs: 31 * DAY - 1,
      elapsedMs: 31 * DAY - 1,
    });
    expect(res.paceMs).toBe(31 * DAY);
  });

  test("nothing elapsed paces to zero", () => {
    expect(
      slaBudget({
        monthMs,
        excusedMs: 0,
        target: 99_000,
        downMs: 0,
        elapsedMs: 0,
      }).paceMs,
    ).toBe(0);
  });
});
