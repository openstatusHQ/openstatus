import { describe, expect, test } from "vitest";

import { meetsQuorum, roundCount, tallyBuckets, tallyDay } from "../tally";

function quorumDay(
  buckets: Array<{ errorRegions: number; notOkRegions: number; runs: number }>,
  regionCount = 6,
) {
  // per-region counts that would read very differently, to prove they are ignored
  return { ok: 50, degraded: 7, error: 9, quorum: { regionCount, buckets } };
}

describe("meetsQuorum", () => {
  test("at least half affected", () => {
    expect(meetsQuorum(3, 6)).toBe(true);
    expect(meetsQuorum(2, 6)).toBe(false);
    expect(meetsQuorum(2, 3)).toBe(true);
    expect(meetsQuorum(1, 3)).toBe(false);
    expect(meetsQuorum(1, 1)).toBe(true);
    expect(meetsQuorum(0, 1)).toBe(false);
  });
});

describe("tallyDay", () => {
  test("counts region checks without a population", () => {
    expect(tallyDay({ ok: 10, degraded: 2, error: 3 }, null)).toEqual({
      up: 12,
      total: 15,
      ok: 10,
      degraded: 2,
      error: 3,
      status: "error",
    });
    expect(tallyDay({ ok: 10, degraded: 2, error: 0 }, null).status).toBe(
      "degraded",
    );
    expect(tallyDay({ ok: 10, degraded: 0, error: 0 }, null).status).toBe(
      "success",
    );
    expect(tallyDay({ ok: 0, degraded: 0, error: 0 }, null)).toEqual({
      up: 0,
      total: 0,
      ok: 0,
      degraded: 0,
      error: 0,
      status: "empty",
    });
  });

  test("1 of 6 regions failing keeps the run up", () => {
    expect(
      tallyDay(quorumDay([{ errorRegions: 1, notOkRegions: 1, runs: 4 }]), 6),
    ).toEqual({
      up: 4,
      total: 4,
      ok: 4,
      degraded: 0,
      error: 0,
      status: "success",
    });
  });

  test("3 of 6 regions failing puts the run down", () => {
    expect(
      tallyDay(
        quorumDay([
          { errorRegions: 3, notOkRegions: 3, runs: 2 },
          { errorRegions: 0, notOkRegions: 0, runs: 8 },
        ]),
        6,
      ),
    ).toEqual({
      up: 8,
      total: 10,
      ok: 8,
      degraded: 0,
      error: 2,
      status: "error",
    });
  });

  test("2 of 6 not ok with no errors stays ok", () => {
    expect(
      tallyDay(quorumDay([{ errorRegions: 0, notOkRegions: 2, runs: 5 }]), 6),
    ).toMatchObject({ up: 5, total: 5, ok: 5, degraded: 0, status: "success" });
  });

  test("3 of 6 not ok is degraded and counts as up", () => {
    expect(
      tallyDay(
        quorumDay([
          { errorRegions: 2, notOkRegions: 3, runs: 3 },
          { errorRegions: 0, notOkRegions: 0, runs: 1 },
        ]),
        6,
      ),
    ).toEqual({
      up: 4,
      total: 4,
      ok: 1,
      degraded: 3,
      error: 0,
      status: "degraded",
    });
  });

  test("an empty histogram is a day without runs", () => {
    expect(tallyDay(quorumDay([]), 6)).toEqual({
      up: 0,
      total: 0,
      ok: 0,
      degraded: 0,
      error: 0,
      status: "empty",
    });
  });
});

describe("run equivalents", () => {
  test("a day without a histogram is converted with the population's region count", () => {
    const day = tallyDay({ ok: 540, degraded: 0, error: 60 }, 6);
    expect(day).toEqual({
      up: 90,
      total: 100,
      ok: 90,
      degraded: 0,
      error: 10,
      status: "error",
    });
    expect(day.up / day.total).toBe(540 / 600);
  });

  test("fractional run equivalents round at display", () => {
    const day = tallyDay({ ok: 595, degraded: 1, error: 4 }, 6);
    expect(day.error).toBeCloseTo(0.667, 3);
    expect(roundCount(day.total)).toBe(100);
    expect(roundCount(day.error)).toBe(1);
    expect(roundCount(day.degraded)).toBe(0);
  });

  test("a frozen histogram keeps its own region count", () => {
    expect(
      tallyDay(
        quorumDay([{ errorRegions: 2, notOkRegions: 2, runs: 4 }], 4),
        6,
      ),
    ).toMatchObject({ total: 4, error: 4 });
  });

  test("without a population the histogram is ignored", () => {
    expect(
      tallyDay(
        quorumDay([{ errorRegions: 3, notOkRegions: 3, runs: 1 }]),
        null,
      ),
    ).toMatchObject({ ok: 50, degraded: 7, error: 9, total: 66 });
  });

  test("a histogram without configured regions is converted like a day without one", () => {
    expect(tallyDay(quorumDay([], 0), 6)).toMatchObject({ total: 11 });
  });
});

describe("tallyBuckets", () => {
  const quorum = (errorRegions: number, runs: number) => ({
    regionCount: 6,
    buckets: [{ errorRegions, notOkRegions: errorRegions, runs }],
  });

  test("sums runs across buckets that carry a quorum", () => {
    expect(
      tallyBuckets(
        [
          { ok: 240, degraded: 0, error: 48, quorum: quorum(1, 48) },
          { ok: 270, degraded: 0, error: 18, quorum: quorum(3, 6) },
        ],
        6,
      ),
    ).toEqual({ up: 48, total: 54 });
  });

  test("converts buckets without a quorum into runs instead of mixing units", () => {
    expect(
      tallyBuckets(
        [
          { ok: 10, degraded: 0, error: 2, quorum: quorum(3, 2) },
          { ok: 282, degraded: 0, error: 6 },
        ],
        6,
      ),
    ).toEqual({ up: 47, total: 50 });
  });

  test("stays in region checks without a population", () => {
    expect(
      tallyBuckets(
        [
          { ok: 90, degraded: 5, error: 5 },
          { ok: 100, degraded: 0, error: 0 },
        ],
        null,
      ),
    ).toEqual({ up: 195, total: 200 });
    expect(tallyBuckets([], null)).toEqual({ up: 0, total: 0 });
  });
});
