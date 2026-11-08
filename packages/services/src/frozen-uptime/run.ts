import { and, db as defaultDb, eq, inArray, isNull } from "@openstatus/db";
import {
  frozenMonitorUptime,
  type MonitorJobType,
  monitor,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import type { OSTinybird } from "@openstatus/tinybird";

import type { DB } from "../context";
import {
  type ComputeCountRow,
  computeMonitorMonth,
  monthRange,
  previousMonth,
} from "./compute";
import { freezeMonitorMonth } from "./freeze";
import {
  quorumByDay,
  type QuorumHistogramRow,
  type QuorumPopulation,
  quorumPopulations,
} from "./quorum";

type PipeFn<Row> = (params: {
  monitorIds: string[];
}) => Promise<{ data: Row[] }>;

export type StatusPipeFn = PipeFn<ComputeCountRow>;
export type QuorumPipeFn = (params: {
  monitorIds: string[];
  timezone?: string;
}) => Promise<{ data: QuorumHistogramRow[] }>;

// no 45d status pipe, so no counts on the live status page either
const JOB_TYPES_WITHOUT_STATUS_PIPE = [
  "udp",
  "ssl",
] as const satisfies readonly MonitorJobType[];

// every other job type must have a pipe: a new MonitorJobType fails tsc in
// uptimeFreezePipes until it is wired up or listed above
export type UptimeFreezeJobType = Exclude<
  MonitorJobType,
  (typeof JOB_TYPES_WITHOUT_STATUS_PIPE)[number]
>;

export type UptimeFreezePipes = Record<UptimeFreezeJobType, StatusPipeFn>;

export function uptimeFreezePipes(tb: OSTinybird): UptimeFreezePipes {
  return {
    http: tb.httpStatus45d,
    tcp: tb.tcpStatus45d,
    dns: tb.dnsStatus45d,
    icmp: tb.icmpStatus45d,
    grpc: tb.grpcStatus45d,
    heartbeat: tb.heartbeatStatus45d,
  };
}

// no run-level histogram: heartbeat has no regions, udp and ssl no status pipe
const JOB_TYPES_WITHOUT_QUORUM = [
  "heartbeat",
  "udp",
  "ssl",
] as const satisfies readonly MonitorJobType[];

// a new MonitorJobType fails tsc in uptimeQuorumPipes until it is wired up or
// listed above
export type UptimeQuorumJobType = Exclude<
  MonitorJobType,
  (typeof JOB_TYPES_WITHOUT_QUORUM)[number]
>;

export type UptimeQuorumPipes = Record<UptimeQuorumJobType, QuorumPipeFn>;

export function uptimeQuorumPipes(tb: OSTinybird): UptimeQuorumPipes {
  return {
    http: tb.httpQuorum45d,
    tcp: tb.tcpQuorum45d,
    dns: tb.dnsQuorum45d,
    icmp: tb.icmpQuorum45d,
    grpc: tb.grpcQuorum45d,
  };
}

export type ChunkFailure = {
  jobType: string;
  monitorIds: string[];
  error: unknown;
};

// zod-bird sends monitorIds as one comma-joined GET query param — unbounded
// batches risk URL-length 400s
const TB_CHUNK_SIZE = 200;
const TB_ATTEMPTS = 3;
// spacing between chunk requests: keeps the monthly sweep from bursting TB
// (zod-bird already absorbs 429/5xx with its own internal retries)
const TB_THROTTLE_MS = 250;

// the status pipes look back a fixed 45 days; past monthStart + 45d the
// earliest month days return no rows and would freeze as permanent zeros
export const FREEZE_CUTOFF_MS = 45 * 86_400_000;

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error(`chunk size must be positive, got ${size}`);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function hasQuorumPipe(
  pipes: UptimeQuorumPipes,
  jobType: string,
): jobType is UptimeQuorumJobType {
  return Object.hasOwn(pipes, jobType);
}

function hasStatusPipe(
  pipes: UptimeFreezePipes,
  jobType: string,
): jobType is UptimeFreezeJobType {
  return Object.hasOwn(pipes, jobType);
}

type FetchOptions = {
  monitorIdsByJobType: Map<string, Set<string>>;
  chunkSize?: number;
  attempts?: number;
  throttleMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onChunkFailure?: (failure: ChunkFailure) => void;
};

async function fetchChunked<Row>(
  args: FetchOptions & {
    pipeFor: (jobType: string) => PipeFn<Row> | undefined;
  },
): Promise<{ rows: Row[]; failedMonitorIds: Set<string> }> {
  const chunkSize = args.chunkSize ?? TB_CHUNK_SIZE;
  const attempts = args.attempts ?? TB_ATTEMPTS;
  const throttleMs = args.throttleMs ?? TB_THROTTLE_MS;
  const sleep =
    args.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  const rows: Row[] = [];
  const failedMonitorIds = new Set<string>();
  let firstChunk = true;

  for (const [jobType, ids] of args.monitorIdsByJobType) {
    const pipe = args.pipeFor(jobType);
    if (!pipe) continue;
    for (const monitorIds of chunk([...ids], chunkSize)) {
      if (!firstChunk && throttleMs > 0) await sleep(throttleMs);
      firstChunk = false;
      let lastError: unknown;
      let done = false;
      for (let attempt = 0; attempt < attempts && !done; attempt++) {
        try {
          if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
          const res = await pipe({ monitorIds });
          rows.push(...res.data);
          done = true;
        } catch (e) {
          lastError = e;
        }
      }
      if (!done) {
        for (const id of monitorIds) failedMonitorIds.add(id);
        args.onChunkFailure?.({ jobType, monitorIds, error: lastError });
      }
    }
  }

  return { rows, failedMonitorIds };
}

/**
 * Fetch daily counts for all monitors, chunked and retried. Monitors whose
 * chunk still fails after retries land in `failedMonitorIds` — they are
 * skipped (never frozen with silent zeros) and picked up by a re-run.
 */
export async function fetchFreezeCounts(
  args: FetchOptions & { pipes: UptimeFreezePipes },
): Promise<{ counts: ComputeCountRow[]; failedMonitorIds: Set<string> }> {
  const { rows, failedMonitorIds } = await fetchChunked({
    ...args,
    pipeFor: (jobType) =>
      hasStatusPipe(args.pipes, jobType) ? args.pipes[jobType] : undefined,
  });
  return { counts: rows, failedMonitorIds };
}

/**
 * Run histograms for the monitors whose job type has a quorum pipe, grouped
 * into the days of `timeZone` (UTC when omitted).
 */
export async function fetchQuorumHistograms(
  args: FetchOptions & { pipes: UptimeQuorumPipes; timeZone?: string },
): Promise<{
  histograms: QuorumHistogramRow[];
  failedMonitorIds: Set<string>;
}> {
  const timezone =
    args.timeZone && args.timeZone !== "UTC" ? args.timeZone : undefined;
  const { rows, failedMonitorIds } = await fetchChunked({
    ...args,
    pipeFor: (jobType) => {
      if (!hasQuorumPipe(args.pipes, jobType)) return undefined;
      const pipe = args.pipes[jobType];
      return timezone
        ? ({ monitorIds }) => pipe({ monitorIds, timezone })
        : pipe;
    },
  });
  return { histograms: rows, failedMonitorIds };
}

export function groupByMonitorId<Row extends { monitorId: string }>(
  rows: Row[],
): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const row of rows) {
    const list = out.get(row.monitorId);
    if (list) list.push(row);
    else out.set(row.monitorId, [row]);
  }
  return out;
}

export function monitorIdsWithQuorum(
  monitors: { id: number; jobType: string }[],
  populations: Map<number, QuorumPopulation>,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const m of monitors) {
    if ((populations.get(m.id)?.regionCount ?? 0) <= 0) continue;
    const ids = out.get(m.jobType) ?? new Set<string>();
    ids.add(String(m.id));
    out.set(m.jobType, ids);
  }
  return out;
}

export type RunUptimeFreezeResult = {
  month: string;
  frozen: number;
  alreadyFrozen: number;
  skipped: number;
  failures: string[];
};

/**
 * Freeze the previous calendar month for every non-deleted monitor.
 * Pipes (and optionally db/now) are injected so the cron stays a thin
 * env/Sentry wrapper and this orchestration is unit-testable.
 */
export async function runUptimeFreeze(args: {
  pipes: UptimeFreezePipes;
  quorumPipes: UptimeQuorumPipes;
  now?: Date;
  db?: DB;
  monitorIds?: number[]; // scope a run (tests, manual retries); default all
  sleep?: (ms: number) => Promise<void>;
  onChunkFailure?: (failure: ChunkFailure) => void;
}): Promise<RunUptimeFreezeResult> {
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();
  const month = previousMonth(now);
  const monthStart = new Date(monthRange(month).start);

  // refuse instead of writing wrong zeros into the write-once table; the
  // failure surfaces via the cron's reportBackgroundError
  if (now.getTime() - monthStart.getTime() >= FREEZE_CUTOFF_MS) {
    return {
      month,
      frozen: 0,
      alreadyFrozen: 0,
      skipped: 0,
      failures: [
        `month ${month}: past the 45d Tinybird window — freezing now would write permanent zero-count days`,
      ],
    };
  }

  // all non-deleted monitors, regardless of page attachment — months without
  // counts are dropped by computeMonitorMonth anyway
  const monitorRows = await db
    .select({
      id: monitor.id,
      workspaceId: monitor.workspaceId,
      jobType: monitor.jobType,
      regions: monitor.regions,
      active: monitor.active,
      updatedAt: monitor.updatedAt,
    })
    .from(monitor)
    .where(
      and(
        isNull(monitor.deletedAt),
        args.monitorIds ? inArray(monitor.id, args.monitorIds) : undefined,
      ),
    );
  // inactive + untouched since before the month ⇒ it was inactive the whole
  // month (pausing bumps updatedAt), so skip the TB fetch entirely; inactive
  // but updated during/after the month may have run part of it — check TB
  const monitors = monitorRows.flatMap((m) =>
    m.workspaceId === null ||
    (!m.active && m.updatedAt !== null && m.updatedAt < monthStart)
      ? []
      : [{ ...m, workspaceId: m.workspaceId }],
  );

  // re-runs only work the monitors that failed last time: those with a frozen
  // row for this month are excluded before any TB fetch (the insert's
  // onConflictDoNothing stays as the race backstop)
  const frozenRows = await db
    .select({ monitorId: frozenMonitorUptime.monitorId })
    .from(frozenMonitorUptime)
    .where(
      args.monitorIds
        ? and(
            eq(frozenMonitorUptime.month, month),
            inArray(frozenMonitorUptime.monitorId, args.monitorIds),
          )
        : eq(frozenMonitorUptime.month, month),
    );
  const frozenMonitorIds = new Set(frozenRows.map((r) => r.monitorId));

  const pending = monitors.filter((m) => !frozenMonitorIds.has(m.id));
  let alreadyFrozen = monitors.length - pending.length;

  const monitorIdsByJobType = new Map<string, Set<string>>();
  for (const m of pending) {
    const ids = monitorIdsByJobType.get(m.jobType) ?? new Set<string>();
    ids.add(String(m.id));
    monitorIdsByJobType.set(m.jobType, ids);
  }

  const { counts, failedMonitorIds } = await fetchFreezeCounts({
    monitorIdsByJobType,
    pipes: args.pipes,
    sleep: args.sleep,
    onChunkFailure: args.onChunkFailure,
  });

  const populations = quorumPopulations(
    pending.filter((m) => hasQuorumPipe(args.quorumPipes, m.jobType)),
  );
  const quorumIdsByJobType = monitorIdsWithQuorum(pending, populations);
  // a month frozen without its histogram can never get one: a failed quorum
  // chunk skips the monitor exactly like a failed counts chunk
  const quorum = await fetchQuorumHistograms({
    monitorIdsByJobType: quorumIdsByJobType,
    pipes: args.quorumPipes,
    sleep: args.sleep,
    onChunkFailure: args.onChunkFailure,
  });
  for (const id of quorum.failedMonitorIds) failedMonitorIds.add(id);
  const histogramsByMonitorId = groupByMonitorId(quorum.histograms);

  // avoid an O(pending²) sweep: computeMonitorMonth scans linearly per call
  const countsByMonitorId = groupByMonitorId(counts);

  const workspaceIds = [...new Set(pending.map((m) => m.workspaceId))];
  const workspaceRows =
    workspaceIds.length > 0
      ? await db
          .select()
          .from(workspace)
          .where(inArray(workspace.id, workspaceIds))
      : [];
  const workspacesById = new Map(
    workspaceRows.map((w) => [w.id, selectWorkspaceSchema.parse(w)]),
  );

  let frozen = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const m of pending) {
    if (failedMonitorIds.has(String(m.id))) {
      skipped++;
      failures.push(`monitor ${m.id}: tinybird counts unavailable`);
      continue;
    }

    // no counts in the month (paused, created later, or no status pipe for
    // the job type): nothing to freeze — silent, not a failure
    const population = populations.get(m.id);
    const computed = computeMonitorMonth({
      month,
      monitorId: m.id,
      counts: countsByMonitorId.get(String(m.id)) ?? [],
      quorum: population
        ? quorumByDay(histogramsByMonitorId.get(String(m.id)) ?? [], population)
        : undefined,
    });
    if (!computed) continue;

    const ws = workspacesById.get(m.workspaceId);
    if (!ws) {
      failures.push(`monitor ${m.id}: workspace ${m.workspaceId} not found`);
      continue;
    }
    const ctx = {
      workspace: ws,
      actor: { type: "system" as const, job: "uptime-freeze" },
      db,
    };

    try {
      const inserted = await freezeMonitorMonth({
        ctx,
        input: { monitorId: m.id, month, days: computed.days },
      });
      if (inserted) frozen++;
      else alreadyFrozen++;
    } catch (e) {
      failures.push(
        `monitor ${m.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return { month, frozen, alreadyFrozen, skipped, failures };
}
