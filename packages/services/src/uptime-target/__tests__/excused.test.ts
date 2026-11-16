import { describe, expect, test } from "vitest";

import { excusedWindowLock, mergeSpans } from "../excused";

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

  test("a window touching a month after the current one is locked", () => {
    expect(
      excusedWindowLock(
        w(Date.UTC(2026, 10, 30, 23), Date.UTC(2026, 11, 1, 1)),
        { now, sealed: [] },
      ),
    ).toBe("closed");
    // 15:00 UTC on Nov 30 is already December in Tokyo
    const tokyoDec = w(Date.UTC(2026, 10, 30, 15), Date.UTC(2026, 10, 30, 16));
    expect(excusedWindowLock(tokyoDec, { now, sealed: [] })).toBeNull();
    expect(
      excusedWindowLock(tokyoDec, { now, sealed: [], timeZone: "Asia/Tokyo" }),
    ).toBe("closed");
  });
});
