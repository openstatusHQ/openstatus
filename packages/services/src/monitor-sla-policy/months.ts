import { TZDate } from "@date-fns/tz";
import type { monitorSlaSealedMonth } from "@openstatus/db/src/schema";

import { monthRange } from "../frozen-uptime/compute";
import { type Counts, NO_RUNS } from "../frozen-uptime/quorum";
import { FREEZE_CUTOFF_MS } from "../frozen-uptime/run";
import { evaluateSlaMonth } from "./evaluate";

export const LAST_TWELVE = 12;

export type MonitorSlaMonth = {
  month: string;
  /**
   * sealed: stored with the terms that applied; preview: frozen, judged under
   * today's terms; live: not frozen yet, provisional; none: nothing to judge
   */
  state: "sealed" | "preview" | "live" | "none";
  /** run verdicts; null without any, or when the excused runs could not be read */
  counts: Counts | null;
  /** run verdicts inside excused windows, dropped from both sides; null with `counts` or when too old to count */
  excused: Counts | null;
  uptime: number | null;
  met: boolean | null;
  sealed: { at: Date; target: number; strict: boolean } | null;
};

function monthKey(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10);
}

/** Whether `timeZone` is an IANA zone this runtime knows. */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** YYYY-MM-01 of the month in `timeZone` holding the instant `at`. */
export function monthOf(at: number | Date, timeZone = "UTC"): string {
  const d = new TZDate(typeof at === "number" ? at : at.getTime(), timeZone);
  return monthKey(d.getFullYear(), d.getMonth());
}

/** The `count` complete months in `timeZone` before `now`, oldest first, YYYY-MM-01. */
export function completeMonths(
  now: Date,
  count: number,
  timeZone = "UTC",
): string[] {
  const [year, mo] = monthOf(now, timeZone).split("-").map(Number);
  return Array.from({ length: count }, (_, i) =>
    monthKey(year, mo - 1 - count + i),
  );
}

/** `from` through `to` (YYYY-MM or YYYY-MM-01), oldest first, YYYY-MM-01. */
export function monthsBetween(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const count = (ty - fy) * 12 + (tm - fm) + 1;
  return Array.from({ length: Math.max(count, 0) }, (_, i) =>
    monthKey(fy, fm - 1 + i),
  );
}

/** Key of one monitor's month in per-cell maps. */
export function monthCellKey(monitorId: number | string, month: string) {
  return `${monitorId}:${month}`;
}

/** [from, to) cut at month boundaries in `timeZone`, in order. */
export function splitByMonth(
  from: number,
  to: number,
  timeZone = "UTC",
): { month: string; start: number; end: number }[] {
  const parts: { month: string; start: number; end: number }[] = [];
  let start = from;
  while (start < to) {
    const month = monthOf(start, timeZone);
    const end = Math.min(monthRange(month, timeZone).end, to);
    parts.push({ month, start, end });
    start = end;
  }
  return parts;
}

/** Whether `month` is the previous month and its runs are still kept: live until it is frozen. */
export function liveUntilFrozen(
  month: string,
  now: Date,
  timeZone = "UTC",
): boolean {
  const [previous] = completeMonths(now, 1, timeZone);
  return (
    month === previous &&
    now.getTime() - monthRange(month, timeZone).start < FREEZE_CUTOFF_MS
  );
}

/** Excused runs for a cell: counts, nothing to excuse, not readable, or too old to count. */
export type CellExcused = Counts | "unavailable" | "expired" | undefined;

function judged(args: {
  month: string;
  state: "preview" | "live";
  counts: Counts;
  excused: CellExcused;
  policy: { target: number; strict: boolean };
}): MonitorSlaMonth {
  const { month, state, counts } = args;
  const runs = counts.ok + counts.degraded + counts.error;
  if (runs === 0 || args.excused === "unavailable") {
    return {
      month,
      state,
      counts: null,
      excused: null,
      uptime: null,
      met: null,
      sealed: null,
    };
  }
  // too old to count: judged without its windows, like the list's preview
  const excused = args.excused === "expired" ? null : (args.excused ?? NO_RUNS);
  const { met, uptime } = evaluateSlaMonth({
    counts,
    excused: excused ?? undefined,
    target: args.policy.target,
    strict: args.policy.strict,
  });
  return {
    month,
    state,
    counts,
    excused,
    uptime,
    met,
    sealed: null,
  };
}

/** A month from what is stored: the seal wins, else the frozen counts under today's terms. */
export function storedMonth(args: {
  month: string;
  seal: typeof monitorSlaSealedMonth.$inferSelect | undefined;
  frozen: Counts | undefined;
  excused?: CellExcused;
  policy: { target: number; strict: boolean };
}): MonitorSlaMonth {
  const { month, seal, frozen, policy } = args;
  if (seal) {
    return {
      month,
      state: "sealed",
      counts: { ok: seal.ok, degraded: seal.degraded, error: seal.error },
      excused: {
        ok: seal.excusedOk,
        degraded: seal.excusedDegraded,
        error: seal.excusedError,
      },
      uptime: seal.uptime,
      met: seal.met,
      sealed: { at: seal.sealedAt, target: seal.target, strict: seal.strict },
    };
  }
  if (!frozen) {
    return {
      month,
      state: "none",
      counts: null,
      excused: null,
      uptime: null,
      met: null,
      sealed: null,
    };
  }
  return judged({
    month,
    state: "preview",
    counts: frozen,
    excused: args.excused,
    policy,
  });
}

/** A month judged from run counts read at request time; undefined counts = none or unavailable. */
export function countedMonth(args: {
  month: string;
  state: "preview" | "live";
  counts: Counts | undefined;
  excused?: CellExcused;
  policy: { target: number; strict: boolean };
}): MonitorSlaMonth {
  return judged({
    month: args.month,
    state: args.state,
    counts: args.counts ?? NO_RUNS,
    excused: args.excused,
    policy: args.policy,
  });
}

export type MonitorSlaStripMonth = {
  month: string;
  status: "met" | "missed" | "none";
  /** a miss with no sealed miss, or a met month with an unsealed judgement */
  preview: boolean;
};

/** One month across a policy's monitors: missed when any monitor missed it. */
export function rollUpMonth(
  month: string,
  cells: readonly MonitorSlaMonth[],
): MonitorSlaStripMonth {
  const misses = cells.filter((c) => c.met === false);
  if (misses.length > 0) {
    return {
      month,
      status: "missed",
      preview: !misses.some((c) => c.state === "sealed"),
    };
  }
  const judged = cells.filter((c) => c.met === true);
  if (judged.length === 0) {
    return { month, status: "none", preview: false };
  }
  return {
    month,
    status: "met",
    preview: judged.some((c) => c.state !== "sealed"),
  };
}
