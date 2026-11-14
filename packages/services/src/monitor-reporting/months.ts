import { TZDate } from "@date-fns/tz";
import type { monitorSlaSealedMonth } from "@openstatus/db/src/schema";
import {
  type MonitorSlaCredit,
  type MonitorSlaCreditSchedule,
  type MonitorSlaMethod,
  slaCredit,
} from "@openstatus/db/src/schema/monitor_sla_policies/constants";

import { monthRange } from "../frozen-uptime/compute";
import { type Counts, NO_RUNS } from "../frozen-uptime/quorum";
import { FREEZE_CUTOFF_MS } from "../frozen-uptime/run";
import { cutExcused, type Episode, evaluateSlaPeriod } from "./episodes";
import type { Span } from "./excused";

export const LAST_TWELVE = 12;

export type SlaTerms = {
  target: number;
  strict: boolean;
  creditSchedule: MonitorSlaCreditSchedule | null;
};

export type MonitorSlaMonth = {
  month: string;
  /**
   * sealed: stored with the terms that applied; preview: the previous month,
   * not sealed yet; live: the running month, provisional; none: nothing to judge
   */
  state: "sealed" | "preview" | "live" | "none";
  /** time: judged on time-weighted episodes; runs: on run counts (legacy seals); null without a judgement */
  method: MonitorSlaMethod | null;
  /** IANA zone the month boundaries are in */
  timeZone: string;
  /** the terms that judged the month; null with no judgement */
  terms: SlaTerms | null;
  /** run verdicts; null without any, or when the excused runs could not be read */
  counts: Counts | null;
  /** run verdicts inside excused windows, dropped from both sides; null with `counts` */
  excused: Counts | null;
  uptime: number | null;
  met: boolean | null;
  /** method "time" only, all ms */
  measuredMs: number | null;
  downMs: number | null;
  excusedMs: number | null;
  unmeasuredMs: number | null;
  /** measured share of the covered, non-excused time; thousandths of a percent */
  coverage: number | null;
  /** computed under the terms' schedule, provisional until sealed; null without a schedule or a judgement */
  credit: MonitorSlaCredit | null;
  sealed: { at: Date; target: number; strict: boolean } | null;
};

const NO_TIME = {
  measuredMs: null,
  downMs: null,
  excusedMs: null,
  unmeasuredMs: null,
  coverage: null,
} as const;

function monthKey(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10);
}

// runtimes disagree on which alias resolvedOptions() reports, so fold them here
const UTC_ALIASES = new Set([
  "utc",
  "etc/utc",
  "uct",
  "etc/uct",
  "gmt",
  "etc/gmt",
  "gmt0",
  "etc/gmt0",
  "gmt+0",
  "etc/gmt+0",
  "gmt-0",
  "etc/gmt-0",
  "greenwich",
  "etc/greenwich",
  "universal",
  "etc/universal",
  "zulu",
  "etc/zulu",
]);

/** The IANA name this runtime resolves `timeZone` to, UTC aliases as "UTC"; null when unknown or a raw offset. */
export function canonicalTimeZone(timeZone: string): string | null {
  const input = timeZone.trim();
  if (!input) return null;
  if (UTC_ALIASES.has(input.toLowerCase())) return "UTC";
  let resolved: string;
  try {
    resolved = new Intl.DateTimeFormat("en-US", {
      timeZone: input,
    }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
  if (/^[+-]/.test(resolved) || /^[+-]/.test(input)) return null;
  return UTC_ALIASES.has(resolved.toLowerCase()) ? "UTC" : resolved;
}

/** Whether `timeZone` is an IANA zone this runtime knows. */
export function isValidTimeZone(timeZone: string): boolean {
  return canonicalTimeZone(timeZone) !== null;
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

/** A member's part of `month`: the month ∩ its membership, capped at `now`; null when empty. */
export function coveredSpan(
  month: string,
  timeZone: string,
  memberSince: Date | number,
  now: Date | number,
): Span | null {
  const range = monthRange(month, timeZone);
  const start = Math.max(range.start, new Date(memberSince).getTime());
  const end = Math.min(range.end, new Date(now).getTime());
  return start < end ? { start, end } : null;
}

/** A month with nothing to judge. */
export function emptyMonth(args: {
  month: string;
  state: MonitorSlaMonth["state"];
  timeZone: string;
  method?: MonitorSlaMethod | null;
}): MonitorSlaMonth {
  return {
    month: args.month,
    state: args.state,
    method: args.method ?? null,
    timeZone: args.timeZone,
    terms: null,
    counts: null,
    excused: null,
    uptime: null,
    met: null,
    ...NO_TIME,
    credit: null,
    sealed: null,
  };
}

function runsByKind(episodes: readonly Episode[]): Counts {
  const sum = { ...NO_RUNS };
  for (const e of episodes) if (e.kind !== "unmeasured") sum[e.kind] += e.runs;
  return sum;
}

function dominantVerdict(episodes: readonly Episode[]): keyof Counts {
  const ms: Counts = { ...NO_RUNS };
  for (const e of episodes)
    if (e.kind !== "unmeasured") ms[e.kind] += e.weightedMs;
  return ms.error >= ms.degraded && ms.error >= ms.ok
    ? "error"
    : ms.degraded >= ms.ok
      ? "degraded"
      : "ok";
}

/**
 * One monitor's unsealed month from its episodes, already clipped to the
 * covered range (month ∩ membership, capped at now).
 */
export function timeMonth(args: {
  month: string;
  state: "preview" | "live";
  episodes: readonly Episode[];
  covered: Span;
  excusedSpans: readonly Span[];
  terms: SlaTerms;
  timeZone: string;
}): MonitorSlaMonth {
  const { terms } = args;
  const result = evaluateSlaPeriod({
    episodes: args.episodes,
    excusedSpans: args.excusedSpans,
    target: terms.target,
    strict: terms.strict,
    coveredMs: Math.max(args.covered.end - args.covered.start, 0),
  });
  const cut = cutExcused(args.episodes, args.excusedSpans);
  const kept = runsByKind(cut.kept);
  const excused = runsByKind(cut.excused);
  const runsIn = (c: Counts) => c.ok + c.degraded + c.error;
  if (result.measuredMs > 0 && runsIn(kept) + runsIn(excused) === 0) {
    // a measured slice with no run estimated inside it still stands for one
    kept[dominantVerdict(cut.kept)] += 1;
  }
  const all = {
    ok: kept.ok + excused.ok,
    degraded: kept.degraded + excused.degraded,
    error: kept.error + excused.error,
  };
  const anyRuns = all.ok + all.degraded + all.error > 0;
  return {
    month: args.month,
    state: args.state,
    method: "time",
    timeZone: args.timeZone,
    terms: {
      target: terms.target,
      strict: terms.strict,
      creditSchedule: terms.creditSchedule,
    },
    counts: anyRuns ? all : null,
    excused: anyRuns ? excused : null,
    uptime: result.uptime,
    met: result.met,
    measuredMs: result.measuredMs,
    downMs: result.downMs,
    excusedMs: result.excusedMs,
    unmeasuredMs: result.unmeasuredMs,
    coverage: result.coverage,
    credit: slaCredit({
      up: result.measuredMs - result.downMs,
      total: result.measuredMs,
      target: terms.target,
      schedule: terms.creditSchedule,
    }),
    sealed: null,
  };
}

/** A month from its seal, with the terms that applied; nothing to judge without one. */
export function storedMonth(args: {
  month: string;
  seal: typeof monitorSlaSealedMonth.$inferSelect | undefined;
  timeZone: string;
}): MonitorSlaMonth {
  const { month, seal } = args;
  if (!seal)
    return emptyMonth({ month, state: "none", timeZone: args.timeZone });
  return {
    month,
    state: "sealed",
    method: seal.method,
    timeZone: seal.timeZone,
    terms: {
      target: seal.target,
      strict: seal.strict,
      creditSchedule: seal.creditSchedule,
    },
    counts: { ok: seal.ok, degraded: seal.degraded, error: seal.error },
    excused: {
      ok: seal.excusedOk,
      degraded: seal.excusedDegraded,
      error: seal.excusedError,
    },
    uptime: seal.uptime,
    met: seal.met,
    measuredMs: seal.measuredMs,
    downMs: seal.downMs,
    excusedMs: seal.excusedMs,
    unmeasuredMs: seal.unmeasuredMs,
    coverage: seal.coverage,
    credit:
      seal.creditSteps === null || seal.creditPct === null
        ? null
        : { steps: seal.creditSteps, pct: seal.creditPct },
    sealed: { at: seal.sealedAt, target: seal.target, strict: seal.strict },
  };
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
