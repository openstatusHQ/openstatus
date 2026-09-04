import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  selectWindow,
  toPipeParams,
  trimToTick,
} from "../response-logs-cursor";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Expand `[tick, rowsInTick]` pairs into rows, in the order given. */
function rowsOf(ticks: [number, number][]) {
  return ticks.flatMap(([cronTimestamp, count]) =>
    Array.from({ length: count }, () => ({ cronTimestamp })),
  );
}

describe("selectWindow", () => {
  const now = 1_700_000_000_000;

  test("falls back to the widest view when the range is open-ended", () => {
    expect(selectWindow(undefined, undefined, now)).toBe("14d");
  });

  test("picks the view by how old the oldest requested row is", () => {
    expect(selectWindow(now - DAY_MS, now, now)).toBe("1d");
    expect(selectWindow(now - DAY_MS - 1, now, now)).toBe("7d");
    expect(selectWindow(now - 7 * DAY_MS, now, now)).toBe("7d");
    expect(selectWindow(now - 7 * DAY_MS - 1, now, now)).toBe("14d");
    expect(selectWindow(now - 14 * DAY_MS, now, now)).toBe("14d");
  });

  test("keeps an expired short range on a view that still holds it", () => {
    // A one-day span that ended a week ago has aged out of the 1 d view.
    expect(selectWindow(now - 9 * DAY_MS, now - 8 * DAY_MS, now)).toBe("14d");
  });
});

describe("toPipeParams", () => {
  test("drops absent and empty filters", () => {
    expect(
      toPipeParams({
        regions: [],
        status: undefined,
        trigger: undefined,
        statusCodes: undefined,
        latencyMin: undefined,
        latencyMax: undefined,
      }),
    ).toEqual({});
  });

  test("keeps every filter that carries a value", () => {
    expect(
      toPipeParams({
        regions: ["ams"],
        status: ["error"],
        trigger: ["cron"],
        statusCodes: [500],
        latencyMin: 0,
        latencyMax: 100,
      }),
    ).toEqual({
      regions: ["ams"],
      status: ["error"],
      trigger: ["cron"],
      statusCodes: [500],
      latencyMin: 0,
      latencyMax: 100,
    });
  });
});

describe("trimToTick", () => {
  test("returns null cursors for an empty page", () => {
    expect(
      trimToTick({
        rows: [],
        limit: 50,
        fetchLimit: 55,
        direction: "next",
        hasCursor: false,
      }),
    ).toEqual({
      rows: [],
      nextCursor: null,
      prevCursor: null,
      truncatedTick: false,
    });
  });

  test("stops on a clean tick boundary", () => {
    const result = trimToTick({
      rows: rowsOf([
        [300, 2],
        [200, 2],
        [100, 2],
      ]),
      limit: 4,
      fetchLimit: 6,
      direction: "next",
      hasCursor: false,
    });
    expect(result.rows.length).toBe(4);
    expect(result.nextCursor).toBe(200);
    expect(result.prevCursor).toBe(null);
  });

  test("drops a trailing tick the pipe's own LIMIT may have cut", () => {
    const result = trimToTick({
      rows: rowsOf([
        [300, 2],
        [200, 2],
      ]),
      limit: 4,
      fetchLimit: 4,
      direction: "next",
      hasCursor: false,
    });
    expect(result.rows.length).toBe(2);
    expect(result.nextCursor).toBe(300);
    expect(result.truncatedTick).toBe(false);
  });

  test("returns a tick wider than the page size whole", () => {
    const result = trimToTick({
      rows: rowsOf([[300, 4]]),
      limit: 2,
      fetchLimit: 6,
      direction: "next",
      hasCursor: false,
    });
    expect(result.rows.length).toBe(4);
    expect(result.truncatedTick).toBe(false);
    // Short of the ceiling, so the tick is whole and the source is drained.
    expect(result.nextCursor).toBe(null);
  });

  test("flags a lone tick that filled the fetch ceiling as truncated", () => {
    // The pipe may have cut this tick, and there is no earlier tick to drop
    // back to; paging past its (exclusive) cursor would lose the remainder.
    const result = trimToTick({
      rows: rowsOf([[300, 4]]),
      limit: 2,
      fetchLimit: 4,
      direction: "next",
      hasCursor: false,
    });
    expect(result.truncatedTick).toBe(true);
  });

  test("reports no next page when the source ran dry", () => {
    const result = trimToTick({
      rows: rowsOf([[300, 2]]),
      limit: 4,
      fetchLimit: 6,
      direction: "next",
      hasCursor: false,
    });
    expect(result.rows.length).toBe(2);
    expect(result.nextCursor).toBe(null);
    expect(result.prevCursor).toBe(null);
  });

  test("only offers a page back once the request came from a cursor", () => {
    const args = {
      rows: rowsOf([
        [300, 2],
        [200, 2],
      ]),
      limit: 4,
      fetchLimit: 6,
      direction: "next" as const,
    };
    expect(trimToTick({ ...args, hasCursor: false }).prevCursor).toBe(null);
    expect(trimToTick({ ...args, hasCursor: true }).prevCursor).toBe(300);
  });

  test("walks the other way for the prev direction", () => {
    const result = trimToTick({
      rows: rowsOf([
        [100, 2],
        [200, 2],
        [300, 2],
      ]),
      limit: 4,
      fetchLimit: 6,
      direction: "prev",
      hasCursor: true,
    });
    expect(result.rows.length).toBe(4);
    expect(result.prevCursor).toBe(200);
    expect(result.nextCursor).toBe(100);
  });
});
