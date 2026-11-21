import type { FrozenMonitorUptimeDay } from "@openstatus/db/src/schema";
import type { OSTinybird } from "@openstatus/tinybird";

import { BUCKET_MINUTES, type LocalDayCount, toLocalDays } from "./buckets";
import {
  type ChunkFailure,
  fetchFreezeCounts,
  fetchRunsByDay,
  type UptimeFreezePipes,
  type UptimeRunsPipes,
  uptimeFreezePipes,
  uptimeRunsPipes,
} from "./run";

/** Live day-count pipes grouped into days of `timeZone`. */
export function liveStatusPipes(
  tb: OSTinybird,
  timeZone: string,
): UptimeFreezePipes {
  // UTC keeps the 45d views; other zones regroup the 15m buckets
  if (timeZone === "UTC") return uptimeFreezePipes(tb);
  const bind =
    (pipe: OSTinybird["httpStatus15m"]) =>
    ({ monitorIds }: { monitorIds: string[] }) =>
      pipe({ monitorIds, timezone: timeZone });
  return {
    http: bind(tb.httpStatus15m),
    tcp: bind(tb.tcpStatus15m),
    dns: bind(tb.dnsStatus15m),
    icmp: bind(tb.icmpStatus15m),
    grpc: bind(tb.grpcStatus15m),
    heartbeat: bind(tb.heartbeatStatus15m),
  };
}

/** Live run-verdict pipes grouped into days of `timeZone`. */
export function liveRunsPipes(
  tb: OSTinybird,
  timeZone: string,
): UptimeRunsPipes {
  // the pipes run their unchanged UTC query only without `timezone`
  if (timeZone === "UTC") return uptimeRunsPipes(tb);
  const bind =
    (pipe: OSTinybird["httpRuns45d"]) =>
    (params: { monitorIds: string[]; days?: number }) =>
      pipe({ ...params, timezone: timeZone });
  return {
    http: bind(tb.httpRuns45d),
    tcp: bind(tb.tcpRuns45d),
    dns: bind(tb.dnsRuns45d),
    icmp: bind(tb.icmpRuns45d),
    grpc: bind(tb.grpcRuns45d),
  };
}

export type FrozenMonth = {
  month: string;
  days: FrozenMonitorUptimeDay[];
  bucketMinutes: number | null;
};

export type LocalDays = {
  requests: LocalDayCount[];
  runs: LocalDayCount[];
  utcOnlyMonths: Set<string>;
};

/**
 * One monitor's days in `timeZone`: live days win from the first one the
 * pipes return, frozen rows (regrouped where they carry ranges) fill earlier
 * days. `utcOnlyMonths` lists the frozen months that could not be regrouped.
 */
export function mergeLocalDays(args: {
  frozen: FrozenMonth[];
  live: Iterable<FrozenMonitorUptimeDay>;
  timeZone: string;
}): LocalDays {
  const live = [...args.live];
  // seam per measure: a failed live runs read must not drop frozen runs
  const firstLive = (measure: "requests" | "runs") =>
    live.reduce<string | null>(
      (min, d) => (d[measure] && (min === null || d.day < min) ? d.day : min),
      null,
    );
  const seam = { requests: firstLive("requests"), runs: firstLive("runs") };

  const requests: LocalDayCount[] = [];
  const runs: LocalDayCount[] = [];
  const utcOnlyMonths = new Set<string>();
  for (const row of args.frozen) {
    const local = (measure: "requests" | "runs") =>
      toLocalDays(row.days, args.timeZone, measure, row.bucketMinutes).filter(
        (d) => seam[measure] === null || d.day < seam[measure],
      );
    const rowRequests = local("requests");
    requests.push(...rowRequests);
    runs.push(...local("runs"));
    if (
      args.timeZone !== "UTC" &&
      row.bucketMinutes !== BUCKET_MINUTES &&
      rowRequests.length > 0
    ) {
      utcOnlyMonths.add(row.month.slice(0, 7));
    }
  }
  for (const d of live) {
    requests.push({ day: d.day, ...d.requests });
    if (d.runs) runs.push({ day: d.day, ...d.runs });
  }

  // a regrouped month's edge days also receive quarter-hours from its neighbours
  const sum = (days: LocalDayCount[]) => {
    const byDay = new Map<string, LocalDayCount>();
    for (const d of days) {
      const acc = byDay.get(d.day);
      if (!acc) {
        byDay.set(d.day, { ...d });
        continue;
      }
      acc.ok += d.ok;
      acc.degraded += d.degraded;
      acc.error += d.error;
    }
    return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
  };
  return { requests: sum(requests), runs: sum(runs), utcOnlyMonths };
}

// the caller only learns `partial`; this is the reason
function warnLiveReadFailed({
  pipe,
  jobType,
  monitorIds,
  error,
}: ChunkFailure) {
  console.warn(
    `uptime-history: live ${jobType} ${pipe} read failed for ${monitorIds.length} monitors: ${error instanceof Error ? error.message : String(error)}`,
  );
}

/**
 * Live per-day counts from the 45d pipes, keyed monitorId → day, with `runs`
 * where the monitor has run verdicts. Never throws: a monitor whose counts
 * failed lands in `failedMonitorIds`; a failed runs read only leaves its days
 * without `runs` and lands in `failedRunsMonitorIds`.
 */
export async function fetchLiveDays(args: {
  monitors: { id: number; jobType: string; regions: string }[];
  pipes: UptimeFreezePipes;
  /** Omit to skip the run read, leaving every day without `runs`. */
  runsPipes?: UptimeRunsPipes;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{
  days: Map<string, Map<string, FrozenMonitorUptimeDay>>;
  failedMonitorIds: Set<string>;
  failedRunsMonitorIds: Set<string>;
}> {
  const monitorIdsByJobType = new Map<string, Set<string>>();
  for (const m of args.monitors) {
    const ids = monitorIdsByJobType.get(m.jobType) ?? new Set<string>();
    ids.add(String(m.id));
    monitorIdsByJobType.set(m.jobType, ids);
  }

  const [counts, runs] = await Promise.all([
    fetchFreezeCounts({
      monitorIdsByJobType,
      pipes: args.pipes,
      throttleMs: 0,
      sleep: args.sleep,
      onChunkFailure: warnLiveReadFailed,
    }),
    args.runsPipes
      ? fetchRunsByDay({
          monitors: args.monitors,
          pipes: args.runsPipes,
          throttleMs: 0,
          sleep: args.sleep,
          onChunkFailure: warnLiveReadFailed,
        })
      : undefined,
  ]);

  const days = new Map<string, Map<string, FrozenMonitorUptimeDay>>();
  for (const row of counts.counts) {
    const byDay = days.get(row.monitorId) ?? new Map();
    const day = row.day.slice(0, 10);
    const acc = byDay.get(day) ?? {
      day,
      requests: { ok: 0, degraded: 0, error: 0 },
    };
    acc.requests.ok += row.ok;
    acc.requests.degraded += row.degraded;
    acc.requests.error += row.error;
    byDay.set(day, acc);
    days.set(row.monitorId, byDay);
  }

  for (const [monitorId, monitorRuns] of runs?.runs ?? []) {
    const byDay = days.get(monitorId);
    if (!byDay) continue;
    for (const [day, dayRuns] of monitorRuns) {
      const acc = byDay.get(day);
      if (acc) acc.runs = dayRuns;
    }
  }

  return {
    days,
    failedMonitorIds: counts.failedMonitorIds,
    failedRunsMonitorIds: runs?.failedMonitorIds ?? new Set(),
  };
}
