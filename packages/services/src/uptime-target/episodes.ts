import type { Span } from "./excused";

export type Verdict = "ok" | "degraded" | "error";

/** Half-open [startedAt, endedAt) in ms epoch. */
export type Episode = {
  kind: Verdict | "unmeasured";
  startedAt: number;
  endedAt: number;
};

export type UptimePeriodResult = {
  measuredMs: number;
  downMs: number;
  excusedMs: number;
  unmeasuredMs: number;
  /** thousandths of a percent, floored; null when nothing was measured */
  uptime: number | null;
  met: boolean | null;
  /** thousandths of a percent, floored; null when the whole period is excused */
  coverage: number | null;
};

const SEVERITY: Record<Verdict, number> = { ok: 0, degraded: 1, error: 2 };

function uniqueRuns(
  runs: readonly { cronTimestamp: number; verdict: Verdict }[],
  fromMs: number,
  toMs: number,
): { at: number; verdict: Verdict }[] {
  const byTime = new Map<number, Verdict>();
  for (const r of runs) {
    if (r.cronTimestamp < fromMs || r.cronTimestamp >= toMs) continue;
    const seen = byTime.get(r.cronTimestamp);
    if (!seen || SEVERITY[r.verdict] > SEVERITY[seen]) {
      byTime.set(r.cronTimestamp, r.verdict);
    }
  }
  return [...byTime]
    .map(([at, verdict]) => ({ at, verdict }))
    .sort((a, b) => a.at - b.at);
}

/** A monitor's runs in [fromMs, toMs) as time-weighted episodes that tile the range. */
export function episodesFromRuns(args: {
  runs: readonly { cronTimestamp: number; verdict: Verdict }[];
  fromMs: number;
  toMs: number;
  fallbackIntervalMs: number;
}): Episode[] {
  const { fromMs, toMs, fallbackIntervalMs } = args;
  if (toMs <= fromMs) return [];
  const out: Episode[] = [];
  const emit = (kind: Episode["kind"], start: number, end: number) => {
    if (end <= start) return;
    const last = out.at(-1);
    if (last && last.kind === kind && last.endedAt === start) {
      last.endedAt = end;
    } else {
      out.push({ kind, startedAt: start, endedAt: end });
    }
  };

  const runs = uniqueRuns(args.runs, fromMs, toMs);
  if (runs.length === 0) {
    emit("unmeasured", fromMs, toMs);
    return out;
  }
  const gap = (i: number) => runs[i + 1].at - runs[i].at;
  const n = runs.length;

  const head = runs[0].at - fromMs;
  const headCadence = n > 1 ? gap(0) : fallbackIntervalMs;
  emit(
    head <= 2 * headCadence ? runs[0].verdict : "unmeasured",
    fromMs,
    runs[0].at,
  );

  for (let i = 0; i < n; i++) {
    const { at, verdict } = runs[i];
    let g: number;
    let c: number;
    if (i < n - 1) {
      g = gap(i);
      const before = i > 0 ? gap(i - 1) : g;
      const after = i + 1 < n - 1 ? gap(i + 1) : g;
      c = Math.max(before, after);
    } else {
      g = toMs - at;
      c = n > 1 ? gap(n - 2) : fallbackIntervalMs;
    }
    if (g <= 2 * c) {
      emit(verdict, at, at + g);
    } else {
      emit(verdict, at, at + c);
      emit("unmeasured", at + c, at + g);
    }
  }
  return out;
}

function normalizeSpans(spans: readonly Span[]): Span[] {
  const sorted = spans
    .filter((s) => s.start < s.end)
    .sort((a, b) => a.start - b.start);
  const merged: Span[] = [];
  for (const s of sorted) {
    const last = merged.at(-1);
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged;
}

/** Splits episodes at the edges of `spans`: the parts outside them are kept, the parts inside excused. */
export function cutExcused(
  episodes: readonly Episode[],
  spans: readonly Span[],
): { kept: Episode[]; excused: Episode[] } {
  const merged = normalizeSpans(spans);
  const kept: Episode[] = [];
  const excused: Episode[] = [];
  for (const e of episodes) {
    const pieces: { start: number; end: number; excused: boolean }[] = [];
    let cursor = e.startedAt;
    for (const s of merged) {
      if (s.end <= cursor) continue;
      if (s.start >= e.endedAt) break;
      if (s.start > cursor)
        pieces.push({ start: cursor, end: s.start, excused: false });
      const end = Math.min(s.end, e.endedAt);
      pieces.push({ start: Math.max(s.start, cursor), end, excused: true });
      cursor = end;
    }
    if (cursor < e.endedAt || pieces.length === 0) {
      pieces.push({ start: cursor, end: e.endedAt, excused: false });
    }
    for (const p of pieces) {
      (p.excused ? excused : kept).push({
        kind: e.kind,
        startedAt: p.start,
        endedAt: p.end,
      });
    }
  }
  return { kept, excused };
}

/** One monitor's period against a policy from its episodes, integer arithmetic only. */
export function evaluateUptimePeriod(args: {
  episodes: readonly Episode[];
  excusedSpans: readonly Span[];
  target: number;
  strict: boolean;
  coveredMs: number;
}): UptimePeriodResult {
  const { kept, excused } = cutExcused(args.episodes, args.excusedSpans);
  let measuredMs = 0;
  let downMs = 0;
  let unmeasuredMs = 0;
  for (const e of kept) {
    const ms = e.endedAt - e.startedAt;
    if (e.kind === "unmeasured") {
      unmeasuredMs += ms;
      continue;
    }
    measuredMs += ms;
    if (e.kind === "error" || (args.strict && e.kind === "degraded")) {
      downMs += ms;
    }
  }
  const excusedMs = excused.reduce((s, e) => s + e.endedAt - e.startedAt, 0);
  const judged = args.coveredMs - excusedMs;
  const up = measuredMs - downMs;
  return {
    measuredMs,
    downMs,
    excusedMs,
    unmeasuredMs,
    uptime: measuredMs > 0 ? Math.floor((up * 100_000) / measuredMs) : null,
    met: measuredMs > 0 ? up * 100_000 >= args.target * measuredMs : null,
    coverage: judged > 0 ? Math.floor((measuredMs * 100_000) / judged) : null,
  };
}

/**
 * Down-time budget over measured time so far plus covered, non-excused time
 * still to come; pace extrapolates the burn over that same horizon.
 */
export function uptimeBudget(args: {
  measuredMs: number;
  remainingMs: number;
  target: number;
  downMs: number;
}): { budgetMs: number; burnedMs: number; leftMs: number; paceMs: number } {
  const horizonMs = args.measuredMs + Math.max(args.remainingMs, 0);
  const budgetMs = Math.floor((horizonMs * (100_000 - args.target)) / 100_000);
  const paceMs =
    args.measuredMs > 0
      ? Number(
          (BigInt(args.downMs) * BigInt(horizonMs)) / BigInt(args.measuredMs),
        )
      : 0;
  return {
    budgetMs,
    burnedMs: args.downMs,
    leftMs: budgetMs - args.downMs,
    paceMs,
  };
}
