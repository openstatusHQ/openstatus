import type { ResponseLogFilters } from "./schemas";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ResponseLogWindow = "1d" | "7d" | "14d";

/**
 * Pick the materialized view to read from. The MVs are rolling TTL windows, so
 * it is the age of the *oldest* row requested — not the span of the range —
 * that decides which one still holds the data: a one-day range that ended a
 * week ago has already expired out of `mv__*_1d__*`.
 */
export function selectWindow(
  fromTimestamp: number | undefined,
  _toTimestamp: number | undefined,
  now: number,
): ResponseLogWindow {
  if (fromTimestamp === undefined) return "14d";
  const age = now - fromTimestamp;
  if (age <= DAY_MS) return "1d";
  if (age <= 7 * DAY_MS) return "7d";
  return "14d";
}

export type ResponseLogPipeFilters = {
  regions?: string[];
  status?: string[];
  trigger?: string[];
  statusCodes?: number[];
  latencyMin?: number;
  latencyMax?: number;
};

/**
 * Drop absent and empty filters so zod-bird never serialises a parameter the
 * pipe would then read as an empty `IN ()`.
 */
export function toPipeParams(
  filters: ResponseLogFilters,
): ResponseLogPipeFilters {
  const params: ResponseLogPipeFilters = {};
  if (filters.regions?.length) params.regions = filters.regions;
  if (filters.status?.length) params.status = filters.status;
  if (filters.trigger?.length) params.trigger = filters.trigger;
  if (filters.statusCodes?.length) params.statusCodes = filters.statusCodes;
  if (filters.latencyMin !== undefined) params.latencyMin = filters.latencyMin;
  if (filters.latencyMax !== undefined) params.latencyMax = filters.latencyMax;
  return params;
}

export type TrimToTickResult<T> = {
  rows: T[];
  nextCursor: number | null;
  prevCursor: number | null;
  /**
   * The page is one tick that filled `fetchLimit`, so the pipe's own LIMIT may
   * have cut it in half. Cursors are exclusive, so paging past it would skip the
   * rest of that tick for good — refetch wider before trusting the cursor.
   */
  truncatedTick: boolean;
};

/**
 * Cut an overfetched page at a cron-tick boundary so a tick is never split
 * across two pages. `fetchLimit` is what the pipe was asked for; returning
 * fewer rows than that means the source is drained and there is no next page.
 */
export function trimToTick<T extends { cronTimestamp: number }>(args: {
  rows: T[];
  limit: number;
  fetchLimit: number;
  direction: "next" | "prev";
  /**
   * The request carried a cursor, so a page exists on the other side of this
   * one. Without it the cursor pointing back the way we came is a dead end —
   * the first page has nothing before it, and handing one back makes
   * `hasPreviousPage` permanently true.
   */
  hasCursor: boolean;
}): TrimToTickResult<T> {
  const { rows, limit, fetchLimit, direction, hasCursor } = args;
  if (rows.length === 0) {
    return {
      rows: [],
      nextCursor: null,
      prevCursor: null,
      truncatedTick: false,
    };
  }

  const kept: T[] = [];
  let index = 0;
  while (index < rows.length && kept.length < limit) {
    const tick = rows[index].cronTimestamp;
    // A tick wider than the page size is returned whole rather than split.
    while (index < rows.length && rows[index].cronTimestamp === tick) {
      kept.push(rows[index]);
      index += 1;
    }
  }

  const hitCeiling = rows.length >= fetchLimit;
  const trailingTick = kept[kept.length - 1].cronTimestamp;
  const trailingIsLast = index === rows.length;
  const distinctTicks = new Set(kept.map((row) => row.cronTimestamp)).size;
  // Same cut, but there is no earlier tick to fall back on, so it cannot be
  // dropped here — flag it and let the caller widen the fetch.
  const truncatedTick = trailingIsLast && hitCeiling && distinctTicks === 1;

  // The pipe's own LIMIT may have cut the final tick in half; drop it unless
  // that would leave the caller with nothing.
  if (trailingIsLast && hitCeiling && distinctTicks > 1) {
    while (
      kept.length > 0 &&
      kept[kept.length - 1].cronTimestamp === trailingTick
    ) {
      kept.pop();
    }
  }

  const timestamps = kept.map((row) => row.cronTimestamp);
  const oldest = Math.min(...timestamps);
  const newest = Math.max(...timestamps);
  const hasMore = kept.length < rows.length || hitCeiling;

  return {
    rows: kept,
    nextCursor:
      direction === "next"
        ? hasMore
          ? oldest
          : null
        : hasCursor
          ? oldest
          : null,
    prevCursor:
      direction === "prev"
        ? hasMore
          ? newest
          : null
        : hasCursor
          ? newest
          : null,
    truncatedTick,
  };
}
