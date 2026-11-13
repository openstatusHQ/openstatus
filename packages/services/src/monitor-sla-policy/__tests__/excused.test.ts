import { describe, expect, test } from "vitest";

import type { UptimeRunsRangePipes } from "../../frozen-uptime/run";
import {
  excusedWindowLock,
  fetchExcusedCounts,
  mergeSpans,
  spansInMonth,
} from "../excused";

const HOUR = 3_600_000;
const at = (d: number, h = 0, m = 0) => Date.UTC(2026, 9, d, h, m);
const w = (from: number, to: number) => ({
  from: new Date(from),
  to: new Date(to),
});

describe("excused spans", () => {
  test("overlapping and touching windows merge into one span", () => {
    expect(
      mergeSpans([
        w(at(5, 2), at(5, 4)),
        w(at(5, 3), at(5, 6)),
        w(at(5, 6), at(5, 7)),
        w(at(9, 1), at(9, 2)),
      ]),
    ).toEqual([
      { start: at(5, 2), end: at(5, 7) },
      { start: at(9, 1), end: at(9, 2) },
    ]);
  });

  test("a window across two months is cut at the month boundary", () => {
    const spans = mergeSpans([w(at(31, 20), Date.UTC(2026, 10, 1, 3))]);
    expect(spansInMonth(spans, "2026-10-01")).toEqual([
      { start: at(31, 20), end: Date.UTC(2026, 10, 1) },
    ]);
    expect(spansInMonth(spans, "2026-11-01")).toEqual([
      { start: Date.UTC(2026, 10, 1), end: Date.UTC(2026, 10, 1, 3) },
    ]);
  });
});

// runs every 10 minutes from Oct 1, every 6th one failed
function runPipes(calls: { fromDate: number; toDate: number }[] = []) {
  const pipe = async (p: {
    monitorIds: string[];
    fromDate: number;
    toDate: number;
  }) => {
    calls.push({ fromDate: p.fromDate, toDate: p.toDate });
    let ok = 0;
    let error = 0;
    const step = 10 * 60_000;
    const first = Math.ceil((p.fromDate - at(1)) / step);
    for (let i = Math.max(first, 0); at(1) + i * step < p.toDate; i++) {
      if (i % 6 === 5) error++;
      else ok++;
    }
    return {
      data: p.monitorIds.map((monitorId) => ({
        monitorId,
        ok,
        degraded: 0,
        error,
      })),
    };
  };
  return {
    http: pipe,
    tcp: pipe,
    dns: pipe,
    icmp: pipe,
    grpc: pipe,
  } as UptimeRunsRangePipes;
}

const monitors = [{ id: 1, jobType: "http", regions: "ams,fra" }];

describe("fetchExcusedCounts", () => {
  test("a member whose type or regions no longer give run verdicts is unreadable, not unexcused", async () => {
    const res = await fetchExcusedCounts({
      monitors: [
        ...monitors,
        { id: 2, jobType: "http", regions: "" },
        { id: 3, jobType: "push", regions: "ams" },
      ],
      spans: mergeSpans([w(at(5, 0), at(5, 1))]),
      months: ["2026-10-01"],
      now: new Date(at(20)),
      pipes: () => runPipes(),
    });
    expect(res.counts.has("1:2026-10-01")).toBe(true);
    expect([...res.unreadable].sort()).toEqual([
      "2:2026-10-01",
      "3:2026-10-01",
    ]);
    expect(res.counts.has("2:2026-10-01")).toBe(false);
    expect(res.failed.size).toBe(0);
  });

  test("overlapping windows excuse each run once", async () => {
    const res = await fetchExcusedCounts({
      monitors,
      spans: mergeSpans([w(at(5, 0), at(5, 2)), w(at(5, 1), at(5, 3))]),
      months: ["2026-10-01"],
      now: new Date(at(20)),
      pipes: () => runPipes(),
    });
    // three hours of 10-minute runs, one in six failed
    expect(res.counts.get("1:2026-10-01")).toEqual({
      ok: 15,
      degraded: 0,
      error: 3,
    });
    expect(res.failed.size).toBe(0);
  });

  test("a month without a window asks nothing", async () => {
    const calls: { fromDate: number; toDate: number }[] = [];
    const res = await fetchExcusedCounts({
      monitors,
      spans: mergeSpans([w(at(5, 0), at(5, 2))]),
      months: ["2026-09-01"],
      now: new Date(at(20)),
      pipes: () => runPipes(calls),
    });
    expect(calls).toEqual([]);
    expect(res.counts.size).toBe(0);
  });

  test("a window whose runs are no longer kept leaves the month unavailable", async () => {
    const res = await fetchExcusedCounts({
      monitors,
      spans: mergeSpans([w(at(2, 0), at(2, 1))]),
      months: ["2026-10-01"],
      now: new Date(at(2) + 46 * 24 * HOUR),
      pipes: () => runPipes(),
    });
    expect(res.expired.has("1:2026-10-01")).toBe(true);
    expect(res.failed.size).toBe(0);
    expect(res.counts.has("1:2026-10-01")).toBe(false);
  });

  test("a failing endpoint leaves the month unavailable, never zero", async () => {
    const failing = {
      ...runPipes(),
      http: async () => {
        throw new Error("down");
      },
    } as UptimeRunsRangePipes;
    const res = await fetchExcusedCounts({
      monitors,
      spans: mergeSpans([w(at(5, 0), at(5, 1))]),
      months: ["2026-10-01"],
      now: new Date(at(20)),
      pipes: () => failing,
      sleep: async () => {},
    });
    expect(res.failed.has("1:2026-10-01")).toBe(true);
  });
});

describe("excusedWindowLock", () => {
  const now = new Date(Date.UTC(2026, 10, 10));

  test("months follow the policy zone", () => {
    // 00:30 on Dec 1 in Berlin; the window is 23:30 on Oct 31 there
    const berlinDec = new Date(Date.UTC(2026, 10, 30, 23, 30));
    const window = w(
      Date.UTC(2026, 9, 31, 22, 30),
      Date.UTC(2026, 9, 31, 22, 45),
    );
    expect(
      excusedWindowLock(window, { now: berlinDec, sealed: [] }),
    ).toBeNull();
    expect(
      excusedWindowLock(window, {
        now: berlinDec,
        sealed: [],
        timeZone: "Europe/Berlin",
      }),
    ).toBe("closed");
    expect(
      excusedWindowLock(window, {
        now: berlinDec,
        sealed: [{ month: "2026-11-01" }],
      }),
    ).toBeNull();
    expect(
      spansInMonth(
        [{ start: window.from.getTime(), end: window.to.getTime() }],
        "2026-11-01",
        "Europe/Berlin",
      ),
    ).toEqual([]);
  });

  test("a window in the current or previous month is open", () => {
    expect(excusedWindowLock(w(at(5), at(6)), { now, sealed: [] })).toBeNull();
  });

  test("a window touching a sealed month is locked", () => {
    const lastUtcHour = w(at(31, 23), at(31, 23, 30));
    expect(
      excusedWindowLock(lastUtcHour, {
        now,
        sealed: [{ month: "2026-10-01" }],
      }),
    ).toBe("sealed");
    expect(
      excusedWindowLock(lastUtcHour, {
        now,
        sealed: [{ month: "2026-09-01" }],
      }),
    ).toBeNull();
  });

  test("a window touching a month older than the previous one is locked", () => {
    expect(
      excusedWindowLock(w(Date.UTC(2026, 8, 30, 22), at(1, 2)), {
        now,
        sealed: [],
      }),
    ).toBe("closed");
  });
});
