import { describe, expect, test } from "vitest";

import { countsRuns, meetsQuorum, tallyBuckets, tallyDay } from "../tally";
import { requestsTally } from "../uptime";

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
  test("falls back to per-region counts without a quorum histogram", () => {
    expect(tallyDay({ ok: 10, degraded: 2, error: 3 })).toEqual({
      up: 12,
      total: 15,
      ok: 10,
      degraded: 2,
      error: 3,
      status: "error",
    });
    expect(tallyDay({ ok: 10, degraded: 2, error: 0 }).status).toBe("degraded");
    expect(tallyDay({ ok: 10, degraded: 0, error: 0 }).status).toBe("success");
    expect(tallyDay({ ok: 0, degraded: 0, error: 0 })).toEqual({
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
      tallyDay(quorumDay([{ errorRegions: 1, notOkRegions: 1, runs: 4 }])),
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
      tallyDay(quorumDay([{ errorRegions: 0, notOkRegions: 2, runs: 5 }])),
    ).toMatchObject({ up: 5, total: 5, ok: 5, degraded: 0, status: "success" });
  });

  test("3 of 6 not ok is degraded and counts as up", () => {
    expect(
      tallyDay(
        quorumDay([
          { errorRegions: 2, notOkRegions: 3, runs: 3 },
          { errorRegions: 0, notOkRegions: 0, runs: 1 },
        ]),
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
    expect(tallyDay(quorumDay([]))).toEqual({
      up: 0,
      total: 0,
      ok: 0,
      degraded: 0,
      error: 0,
      status: "empty",
    });
  });
});

describe("countsRuns", () => {
  test("only a histogram with configured regions makes the day count runs", () => {
    expect(countsRuns(quorumDay([]))).toBe(true);
    expect(countsRuns(quorumDay([], 0))).toBe(false);
    expect(countsRuns({ ok: 1, degraded: 0, error: 0 })).toBe(false);
  });
});

describe("requestsTally", () => {
  test("sums quorum days in runs and other days in region checks", () => {
    expect(
      requestsTally([
        { ok: 10, degraded: 0, error: 2 },
        quorumDay([{ errorRegions: 3, notOkRegions: 3, runs: 1 }]),
      ]),
    ).toEqual({ up: 10, total: 13 });
  });
});

describe("tallyBuckets", () => {
  const quorum = (errorRegions: number, runs: number) => ({
    regionCount: 6,
    buckets: [{ errorRegions, notOkRegions: errorRegions, runs }],
  });

  test("sums runs across buckets that carry a quorum", () => {
    expect(
      tallyBuckets([
        { ok: 240, degraded: 0, error: 48, quorum: quorum(1, 48) },
        { ok: 270, degraded: 0, error: 18, quorum: quorum(3, 6) },
      ]),
    ).toEqual({ up: 48, total: 54, runs: true });
  });

  test("stays in region checks when no bucket has a quorum", () => {
    expect(
      tallyBuckets([
        { ok: 90, degraded: 5, error: 5 },
        { ok: 100, degraded: 0, error: 0 },
      ]),
    ).toEqual({ up: 195, total: 200, runs: false });
    expect(tallyBuckets([])).toEqual({ up: 0, total: 0, runs: false });
  });
});
