import type { monitorPeriodicity } from "@openstatus/db/src/schema/constants";
import type { OSTinybird } from "@openstatus/tinybird";

import { quorumRegionCount } from "../frozen-uptime/quorum";
import {
  type FetchOptions,
  fetchChunked,
  hasRuns,
  type UptimeQuorumJobType,
} from "../frozen-uptime/run";
import { cutExcused, type Episode } from "./episodes";

export type SlaEpisodesPipeFn = (params: {
  monitorIds: string[];
  fromDate: number;
  toDate: number;
  fallbackIntervalMs: number;
}) => Promise<{ data: (Episode & { monitorId: string })[] }>;

export type SlaEpisodesPipes = Record<UptimeQuorumJobType, SlaEpisodesPipeFn>;

export function slaEpisodesPipes(tb: OSTinybird): SlaEpisodesPipes {
  return {
    http: tb.httpSlaEpisodesRange,
    tcp: tb.tcpSlaEpisodesRange,
    dns: tb.dnsSlaEpisodesRange,
    icmp: tb.icmpSlaEpisodesRange,
    grpc: tb.grpcSlaEpisodesRange,
  };
}

type MonitorPeriodicity = (typeof monitorPeriodicity)[number];

const PERIODICITY_MS: Record<MonitorPeriodicity, number> = {
  "30s": 30_000,
  "1m": 60_000,
  "5m": 300_000,
  "10m": 600_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  // unknown cadence: the longest scheduled one, so a lone run is not cut short
  other: 3_600_000,
};

/** The monitor's current cadence in ms: the pipes' `fallbackIntervalMs`. */
export function periodicityMs(periodicity: string): number {
  return Object.hasOwn(PERIODICITY_MS, periodicity)
    ? PERIODICITY_MS[periodicity as MonitorPeriodicity]
    : PERIODICITY_MS.other;
}

export type EpisodeMonitor = {
  id: number;
  jobType: string;
  regions: string;
  periodicity: string;
};

/**
 * Episodes per monitor over [fromMs, toMs), batched by job type and cadence,
 * chunked and retried. Never throws: failed chunks land in `failed`. Monitors
 * without run verdicts (no cloud regions, no runs pipe) are in neither.
 * Only ranges inside the 47-day TTL are meaningful: older runs read as unmeasured.
 */
export async function fetchSlaEpisodes(
  args: Omit<FetchOptions, "monitorIdsByJobType"> & {
    monitors: readonly EpisodeMonitor[];
    fromMs: number;
    toMs: number;
    pipes: () => SlaEpisodesPipes;
  },
): Promise<{ episodes: Map<number, Episode[]>; failed: Set<number> }> {
  const episodes = new Map<number, Episode[]>();
  const batches = new Map<string, Set<string>>();
  const intervalOf = new Map<string, { jobType: string; ms: number }>();
  for (const m of args.monitors) {
    if (!hasRuns(m.jobType) || quorumRegionCount(m.regions) === null) continue;
    const ms = periodicityMs(m.periodicity);
    const key = `${m.jobType}:${ms}`;
    intervalOf.set(key, { jobType: m.jobType, ms });
    const ids = batches.get(key) ?? new Set<string>();
    ids.add(String(m.id));
    batches.set(key, ids);
  }
  if (batches.size === 0 || args.toMs <= args.fromMs) {
    return { episodes, failed: new Set() };
  }

  let pipes: SlaEpisodesPipes;
  try {
    pipes = args.pipes();
  } catch (e) {
    console.warn("monitor sla episodes unavailable", e);
    return {
      episodes,
      failed: new Set(
        [...batches.values()].flatMap((ids) => [...ids].map(Number)),
      ),
    };
  }
  const { rows, failedMonitorIds } = await fetchChunked({
    ...args,
    monitorIdsByJobType: batches,
    kind: "runs",
    pipeFor: (key) => {
      const batch = intervalOf.get(key);
      if (!batch || !hasRuns(batch.jobType)) return undefined;
      const pipe = pipes[batch.jobType];
      return ({ monitorIds }) =>
        pipe({
          monitorIds,
          fromDate: args.fromMs,
          toDate: args.toMs,
          fallbackIntervalMs: batch.ms,
        });
    },
  });
  for (const { monitorId, ...episode } of rows) {
    if (failedMonitorIds.has(monitorId)) continue;
    const id = Number(monitorId);
    const list = episodes.get(id);
    if (list) list.push(episode);
    else episodes.set(id, [episode]);
  }
  for (const list of episodes.values()) {
    list.sort((a, b) => a.startedAt - b.startedAt);
  }
  return { episodes, failed: new Set([...failedMonitorIds].map(Number)) };
}

/** The parts of `episodes` inside [fromMs, toMs), split at the edges with weights prorated. */
export function clipEpisodes(
  episodes: readonly Episode[],
  fromMs: number,
  toMs: number,
): Episode[] {
  if (toMs <= fromMs) return [];
  // the pieces cutExcused sets aside are exactly those inside the span
  return cutExcused(episodes, [{ start: fromMs, end: toMs }]).excused;
}
