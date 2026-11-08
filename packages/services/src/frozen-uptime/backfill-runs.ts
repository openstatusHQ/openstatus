import { and, db as defaultDb, eq, inArray } from "@openstatus/db";
import {
  type FrozenMonitorUptimeDay,
  frozenMonitorUptime,
  frozenMonitorUptimeDaySchema,
  frozenMonitorUptimeMonthSchema,
  monitor,
} from "@openstatus/db/src/schema";
import type { OSTinybird } from "@openstatus/tinybird";

import type { DB } from "../context";
import { withBusyRetry } from "../retry";
import { monthRange } from "./compute";
import {
  type QuorumHistogramRow,
  quorumRegionCount,
  runsByDay,
} from "./quorum";
import {
  type ChunkFailure,
  fetchChunked,
  groupByMonitorId,
  hasQuorumPipe,
  type UptimeQuorumJobType,
} from "./run";

export type QuorumBackfillPipeFn = (params: {
  monitorIds: string[];
  fromDate: string;
  toDate: string;
}) => Promise<{ data: QuorumHistogramRow[] }>;

export type UptimeQuorumBackfillPipes = Record<
  UptimeQuorumJobType,
  QuorumBackfillPipeFn
>;

export function uptimeQuorumBackfillPipes(
  tb: OSTinybird,
): UptimeQuorumBackfillPipes {
  return {
    http: tb.httpQuorumBackfill,
    tcp: tb.tcpQuorumBackfill,
    dns: tb.dnsQuorumBackfill,
    icmp: tb.icmpQuorumBackfill,
    grpc: tb.grpcQuorumBackfill,
  };
}

export type BackfillFrozenRunsResult = {
  month: string;
  dryRun: boolean;
  rows: number;
  // with dryRun: rows and days that would be written
  updated: number;
  daysFilled: number;
  upToDate: number;
  noPopulation: number[];
  failed: number[];
  noData: number[];
  failures: string[];
};

function lacksRuns(day: FrozenMonitorUptimeDay): boolean {
  const { ok, degraded, error } = day.requests;
  return day.runs === undefined && ok + degraded + error > 0;
}

/**
 * Adds run verdicts, recomputed from raw Tinybird data, to the days of one
 * frozen month that have requests but no runs; nothing else in a row changes.
 */
export async function backfillFrozenRuns(args: {
  month: string; // YYYY-MM-01
  pipes: UptimeQuorumBackfillPipes;
  monitorIds?: number[];
  dryRun?: boolean;
  db?: DB;
  sleep?: (ms: number) => Promise<void>;
  onChunkFailure?: (failure: ChunkFailure) => void;
}): Promise<BackfillFrozenRunsResult> {
  const month = frozenMonitorUptimeMonthSchema.parse(args.month);
  const db = args.db ?? defaultDb;
  const dryRun = args.dryRun ?? false;
  const { start, end } = monthRange(month);

  const rows = await db
    .select({
      id: frozenMonitorUptime.id,
      monitorId: frozenMonitorUptime.monitorId,
      days: frozenMonitorUptime.days,
      jobType: monitor.jobType,
      regions: monitor.regions,
    })
    .from(frozenMonitorUptime)
    .innerJoin(monitor, eq(monitor.id, frozenMonitorUptime.monitorId))
    .where(
      and(
        eq(frozenMonitorUptime.month, month),
        args.monitorIds
          ? inArray(frozenMonitorUptime.monitorId, args.monitorIds)
          : undefined,
      ),
    );

  const result: BackfillFrozenRunsResult = {
    month,
    dryRun,
    rows: rows.length,
    updated: 0,
    daysFilled: 0,
    upToDate: 0,
    noPopulation: [],
    failed: [],
    noData: [],
    failures: [],
  };

  // region history is not stored: runs are judged against today's regions
  const pending: {
    id: number;
    monitorId: number;
    jobType: string;
    days: FrozenMonitorUptimeDay[];
    regionCount: number;
  }[] = [];
  for (const row of rows) {
    const regionCount = hasQuorumPipe(args.pipes, row.jobType)
      ? quorumRegionCount(row.regions)
      : null;
    if (regionCount === null) {
      result.noPopulation.push(row.monitorId);
      continue;
    }
    const days = frozenMonitorUptimeDaySchema.array().parse(row.days);
    if (!days.some(lacksRuns)) {
      result.upToDate++;
      continue;
    }
    pending.push({ ...row, days, regionCount });
  }

  const monitorIdsByJobType = new Map<string, Set<string>>();
  for (const row of pending) {
    const ids = monitorIdsByJobType.get(row.jobType) ?? new Set<string>();
    ids.add(String(row.monitorId));
    monitorIdsByJobType.set(row.jobType, ids);
  }

  const fromDate = new Date(start).toISOString();
  const toDate = new Date(end).toISOString();
  const { rows: histograms, failedMonitorIds } =
    await fetchChunked<QuorumHistogramRow>({
      monitorIdsByJobType,
      kind: "quorum",
      sleep: args.sleep,
      onChunkFailure: args.onChunkFailure,
      pipeFor: (jobType) => {
        if (!hasQuorumPipe(args.pipes, jobType)) return undefined;
        const pipe = args.pipes[jobType];
        return ({ monitorIds }) => pipe({ monitorIds, fromDate, toDate });
      },
    });
  const histogramsByMonitorId = groupByMonitorId(histograms);

  for (const row of pending) {
    if (failedMonitorIds.has(String(row.monitorId))) {
      result.failed.push(row.monitorId);
      continue;
    }
    const runs = runsByDay(
      histogramsByMonitorId.get(String(row.monitorId)) ?? [],
      row.regionCount,
    );
    let filled = 0;
    const days = row.days.map((day) => {
      const dayRuns = lacksRuns(day) ? runs.get(day.day) : undefined;
      if (!dayRuns) return day;
      filled++;
      return { ...day, runs: dayRuns };
    });
    if (filled === 0) {
      result.noData.push(row.monitorId);
      continue;
    }

    // no audit row, like the freeze: a system job amending derived data
    if (!dryRun) {
      try {
        await withBusyRetry(() =>
          db
            .update(frozenMonitorUptime)
            .set({ days })
            .where(eq(frozenMonitorUptime.id, row.id)),
        );
      } catch (e) {
        result.failures.push(
          `monitor ${row.monitorId}: ${e instanceof Error ? e.message : String(e)}`,
        );
        continue;
      }
    }
    result.updated++;
    result.daysFilled += filled;
  }

  return result;
}
