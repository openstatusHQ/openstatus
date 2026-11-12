import { uniqueRegions } from "@openstatus/utils";

export type Counts = { ok: number; degraded: number; error: number };

export const NO_RUNS: Readonly<Counts> = Object.freeze({
  ok: 0,
  degraded: 0,
  error: 0,
});

/** Adds `c` into the counts under `key`. */
export function addCounts<K>(map: Map<K, Counts>, key: K, c: Counts): void {
  const acc = map.get(key) ?? { ...NO_RUNS };
  acc.ok += c.ok;
  acc.degraded += c.degraded;
  acc.error += c.error;
  map.set(key, acc);
}

// mirrors the cloud-region quorum in apps/workflows/src/checker/transition.ts;
// private-only monitors get none: private checks carry no shared run key
/** The monitor's unique cloud regions, null without any: it gets no run verdicts. */
export function quorumRegionCount(regions: string): number | null {
  const cloud = uniqueRegions(regions);
  return cloud.length > 0 ? cloud.length : null;
}

/** monitorId → YYYY-MM-DD → that day's run verdicts. */
export type RunsByDay = Map<string, Map<string, Counts>>;

export function runsByMonitorDay(
  rows: (Counts & { monitorId: string; day: string })[],
): RunsByDay {
  const out: RunsByDay = new Map();
  for (const { monitorId, day, ok, degraded, error } of rows) {
    if (ok + degraded + error <= 0) continue;
    const byDay = out.get(monitorId) ?? new Map<string, Counts>();
    const key = day.slice(0, 10);
    const acc = byDay.get(key) ?? { ok: 0, degraded: 0, error: 0 };
    acc.ok += ok;
    acc.degraded += degraded;
    acc.error += error;
    byDay.set(key, acc);
    out.set(monitorId, byDay);
  }
  return out;
}
