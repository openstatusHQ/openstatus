import { describe, expect, test } from "vitest";

import {
  meetsQuorum,
  roundCount,
  shownCounts,
  shownTotal,
  tallyBuckets,
  tallyDay,
} from "../tally";

const r = (ok: number, degraded: number, error: number) => ({
  requests: { ok, degraded, error },
});

// region checks that would read very differently, to prove they are ignored
function runsDay(ok: number, degraded: number, error: number) {
  return {
    requests: { ok: 50, degraded: 7, error: 9 },
    runs: { ok, degraded, error },
  };
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
  test("counts region checks without a region count", () => {
    expect(tallyDay(r(10, 2, 3), null)).toEqual({
      up: 12,
      total: 15,
      ok: 10,
      degraded: 2,
      error: 3,
      status: "error",
    });
    expect(tallyDay(r(10, 2, 0), null).status).toBe("degraded");
    expect(tallyDay(r(10, 0, 0), null).status).toBe("success");
    expect(tallyDay(r(0, 0, 0), null)).toEqual({
      up: 0,
      total: 0,
      ok: 0,
      degraded: 0,
      error: 0,
      status: "empty",
    });
  });

  test("counts run verdicts when the monitor has a region count", () => {
    expect(tallyDay(runsDay(8, 1, 2), 6)).toEqual({
      up: 9,
      total: 11,
      ok: 8,
      degraded: 1,
      error: 2,
      status: "error",
    });
  });

  test("a day whose runs are all zero is empty", () => {
    expect(tallyDay(runsDay(0, 0, 0), 6)).toMatchObject({
      total: 0,
      status: "empty",
    });
  });
});

describe("run equivalents", () => {
  test("a day without runs is converted with the region count", () => {
    const day = tallyDay(r(540, 0, 60), 6);
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
    const day = tallyDay(r(595, 1, 4), 6);
    expect(day.error).toBeCloseTo(0.667, 3);
    expect(roundCount(day.total)).toBe(100);
    expect(roundCount(day.error)).toBe(1);
    expect(roundCount(day.degraded)).toBe(0);
  });

  test("a converted day's status follows its shown counts, crossing at half a run", () => {
    const one = tallyDay(r(599, 0, 1), 6);
    expect(shownCounts(one)).toEqual({ ok: 100, degraded: 0, error: 0 });
    expect(one.status).toBe("success");
    expect(one.up / one.total).toBe(599 / 600);
    expect(tallyDay(r(598, 0, 2), 6).status).toBe("success");
    const three = tallyDay(r(597, 0, 3), 6);
    expect(shownCounts(three).error).toBe(1);
    expect(three.status).toBe("error");
    expect(tallyDay(r(597, 3, 0), 6).status).toBe("degraded");
  });

  test("runs are taken as they are, whatever the region count", () => {
    expect(tallyDay(runsDay(0, 0, 4), 4)).toEqual(
      tallyDay(runsDay(0, 0, 4), 6),
    );
  });

  test("without a region count runs are ignored", () => {
    expect(tallyDay(runsDay(0, 0, 1), null)).toMatchObject({
      ok: 50,
      degraded: 7,
      error: 9,
      total: 66,
    });
  });
});

describe("tallyBuckets", () => {
  test("sums runs across buckets that carry runs", () => {
    expect(
      tallyBuckets(
        [
          { ...r(240, 0, 48), runs: { ok: 48, degraded: 0, error: 0 } },
          { ...r(270, 0, 18), runs: { ok: 0, degraded: 0, error: 6 } },
        ],
        6,
      ),
    ).toEqual({ up: 48, total: 54 });
  });

  test("converts buckets without runs into runs instead of mixing units", () => {
    expect(
      tallyBuckets(
        [
          { ...r(10, 0, 2), runs: { ok: 0, degraded: 0, error: 2 } },
          r(282, 0, 6),
        ],
        6,
      ),
    ).toEqual({ up: 47, total: 50 });
  });

  test("stays in region checks without a region count", () => {
    expect(tallyBuckets([r(90, 5, 5), r(100, 0, 0)], null)).toEqual({
      up: 195,
      total: 200,
    });
    expect(tallyBuckets([], null)).toEqual({ up: 0, total: 0 });
  });
});

describe("shownTotal", () => {
  test("equals the sum of each bucket's shown counts on a converted window", () => {
    const buckets = [r(1437, 0, 3), r(1440, 0, 0), r(1434, 2, 4)];
    const chart = buckets
      .map((b) => shownCounts(tallyDay(b, 6)))
      .reduce((sum, c) => sum + c.ok + c.degraded + c.error, 0);
    expect(shownTotal(buckets, 6)).toBe(chart);
    expect(chart).toBe(721);
    expect(roundCount(tallyBuckets(buckets, 6).total)).toBe(720);
  });
});
