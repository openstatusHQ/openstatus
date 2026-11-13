import type { Span } from "./excused";

export type Verdict = "ok" | "degraded" | "error";

/** Half-open [startedAt, endedAt) in ms epoch; unmeasured episodes have runs = 0. */
export type Episode = {
  kind: Verdict | "unmeasured";
  startedAt: number;
  endedAt: number;
  runs: number;
  weightedMs: number;
};

export type SlaPeriodResult = {
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
  const emit = (
    kind: Episode["kind"],
    start: number,
    end: number,
    runs: number,
  ) => {
    if (end <= start && runs === 0) return;
    const last = out.at(-1);
    if (last && last.kind === kind && last.endedAt === start) {
      last.endedAt = end;
      last.runs += runs;
      last.weightedMs += end - start;
    } else {
      out.push({
        kind,
        startedAt: start,
        endedAt: end,
        runs,
        weightedMs: end - start,
      });
    }
  };

  const runs = uniqueRuns(args.runs, fromMs, toMs);
  if (runs.length === 0) {
    emit("unmeasured", fromMs, toMs, 0);
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
    0,
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
      emit(verdict, at, at + g, 1);
    } else {
      emit(verdict, at, at + c, 1);
      emit("unmeasured", at + c, at + g, 0);
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

// floor shares, remainder to the last piece, so the pieces sum to `total` exactly
function prorate(total: number, lengths: readonly number[]): number[] {
  const whole = lengths.reduce((s, l) => s + l, 0);
  if (whole <= 0)
    return lengths.map((_, i) => (i === lengths.length - 1 ? total : 0));
  const shares = lengths.map((l) =>
    Number((BigInt(total) * BigInt(l)) / BigInt(whole)),
  );
  shares[shares.length - 1] =
    total - shares.slice(0, -1).reduce((s, x) => s + x, 0);
  return shares;
}

// runs of `e` at offsets below `offset`, run i of n sitting at floor(i × length / n)
function runsBefore(e: Episode, offset: number): number {
  const length = e.endedAt - e.startedAt;
  if (offset <= 0 || e.runs === 0) return 0;
  if (offset >= length) return e.runs;
  const n = BigInt(e.runs);
  const at = (BigInt(offset) * n + BigInt(length) - 1n) / BigInt(length);
  return Number(at < n ? at : n);
}

/** Splits episodes at the edges of `spans` (ms-precise); weights are prorated by overlap, runs go where they sit. */
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
    if (pieces.length === 1) {
      (pieces[0].excused ? excused : kept).push(e);
      continue;
    }
    const weights = prorate(
      e.weightedMs,
      pieces.map((p) => p.end - p.start),
    );
    pieces.forEach((p, i) => {
      (p.excused ? excused : kept).push({
        kind: e.kind,
        startedAt: p.start,
        endedAt: p.end,
        runs:
          runsBefore(e, p.end - e.startedAt) -
          runsBefore(e, p.start - e.startedAt),
        weightedMs: weights[i],
      });
    });
  }
  return { kept, excused };
}

/** One monitor's period against a policy from its episodes, integer arithmetic only. */
export function evaluateSlaPeriod(args: {
  episodes: readonly Episode[];
  excusedSpans: readonly Span[];
  target: number;
  strict: boolean;
  coveredMs: number;
}): SlaPeriodResult {
  const { kept, excused } = cutExcused(args.episodes, args.excusedSpans);
  let measuredMs = 0;
  let downMs = 0;
  let unmeasuredMs = 0;
  for (const e of kept) {
    if (e.kind === "unmeasured") {
      unmeasuredMs += e.weightedMs;
      continue;
    }
    measuredMs += e.weightedMs;
    if (e.kind === "error" || (args.strict && e.kind === "degraded")) {
      downMs += e.weightedMs;
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
export function slaBudget(args: {
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
