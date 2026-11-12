import type { FrozenMonitorUptimeDay } from "@openstatus/db/src/schema";

import { type Counts, NO_RUNS } from "../frozen-uptime/quorum";

export type SlaMonthResult = {
  total: number;
  up: number;
  /** null: no runs, so no judgement */
  met: boolean | null;
  /** thousandths of a percent, floored; null without runs */
  uptime: number | null;
};

/** One monitor's month against a policy, integer arithmetic only. */
export function evaluateSlaMonth(args: {
  counts: Counts;
  excused?: Counts;
  target: number;
  strict: boolean;
}): SlaMonthResult {
  const c = args.counts;
  const x = args.excused ?? NO_RUNS;
  const total = c.ok + c.degraded + c.error - (x.ok + x.degraded + x.error);
  const up = c.ok - x.ok + (args.strict ? 0 : c.degraded - x.degraded);
  if (total <= 0) return { total: 0, up: 0, met: null, uptime: null };
  return {
    total,
    up,
    met: up * 100_000 >= args.target * total,
    uptime: Math.floor((up * 100_000) / total),
  };
}

/** Run verdicts of a frozen month; days without them add nothing. */
export function sumMonthRuns(days: readonly FrozenMonitorUptimeDay[]): Counts {
  const sum = { ...NO_RUNS };
  for (const d of days) {
    if (!d.runs) continue;
    sum.ok += d.runs.ok;
    sum.degraded += d.runs.degraded;
    sum.error += d.runs.error;
  }
  return sum;
}
