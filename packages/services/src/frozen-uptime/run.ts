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
  addCounts,
  type Counts,
  quorumRegionCount,
  type RunsByDay,
  runsByMonitorDay,
} from "./quorum";

export type PipeFn<Row> = (params: {
  monitorIds: string[];
}) => Promise<{ data: Row[] }>;

export type StatusPipeFn = PipeFn<ComputeCountRow>;

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

// no run verdicts: heartbeat has no regions, udp and ssl no status pipe
const JOB_TYPES_WITHOUT_QUORUM = [
  "heartbeat",
  "udp",
  "ssl",
] as const satisfies readonly MonitorJobType[];

export type UptimeQuorumJobType = Exclude<
  MonitorJobType,
  (typeof JOB_TYPES_WITHOUT_QUORUM)[number]
>;

/** Day-count pipes that return run verdicts instead of region checks. */
export type UptimeRunsPipes = Record<UptimeQuorumJobType, StatusPipeFn>;

export function uptimeRunsPipes(tb: OSTinybird): UptimeRunsPipes {
  return {
    http: tb.httpRuns45d,
    tcp: tb.tcpRuns45d,
    dns: tb.dnsRuns45d,
    icmp: tb.icmpRuns45d,
    grpc: tb.grpcRuns45d,
  };
}

// a new MonitorJobType fails tsc here until it is wired up or listed above
const RUNS_JOB_TYPES = {
  http: true,
  tcp: true,
  dns: true,
  icmp: true,
  grpc: true,
} satisfies Record<UptimeQuorumJobType, true>;

export function hasRuns(jobType: string): jobType is UptimeQuorumJobType {
  return Object.hasOwn(RUNS_JOB_TYPES, jobType);
}

/** Whether the monitor gets run verdicts: a job type with runs pipes and cloud regions. */
export function countsRuns(m: { jobType: string; regions: string }): boolean {
  return hasRuns(m.jobType) && quorumRegionCount(m.regions) !== null;
}

export type FreezePipeKind = "counts" | "runs";

export type ChunkFailure = {
  pipe: FreezePipeKind;
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

function hasStatusPipe(
  pipes: UptimeFreezePipes,
  jobType: string,
): jobType is UptimeFreezeJobType {
  return Object.hasOwn(pipes, jobType);
}

export type FetchOptions = {
  monitorIdsByJobType: Map<string, Set<string>>;
  chunkSize?: number;
  attempts?: number;
  throttleMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onChunkFailure?: (failure: ChunkFailure) => void;
};

export async function fetchChunked<Row>(
  args: FetchOptions & {
    kind: FreezePipeKind;
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
        args.onChunkFailure?.({
          pipe: args.kind,
          jobType,
          monitorIds,
          error: lastError,
        });
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
    kind: "counts",
    pipeFor: (jobType) =>
      hasStatusPipe(args.pipes, jobType) ? args.pipes[jobType] : undefined,
  });
  return { counts: rows, failedMonitorIds };
}

/**
 * Run verdicts per UTC day (or per day of the zone the pipes are bound to) for
 * the monitors with cloud regions; the others are never fetched.
 */
export async function fetchRunsByDay(
  args: Omit<FetchOptions, "monitorIdsByJobType"> & {
    monitors: { id: number; jobType: string; regions: string }[];
    pipes: UptimeRunsPipes;
  },
): Promise<{ runs: RunsByDay; failedMonitorIds: Set<string> }> {
  const monitorIdsByJobType = new Map<string, Set<string>>();
  for (const m of args.monitors) {
    if (!countsRuns(m)) continue;
    const ids = monitorIdsByJobType.get(m.jobType) ?? new Set<string>();
    ids.add(String(m.id));
    monitorIdsByJobType.set(m.jobType, ids);
  }
  const { rows, failedMonitorIds } = await fetchChunked({
    ...args,
    monitorIdsByJobType,
    kind: "runs",
    pipeFor: (jobType) => (hasRuns(jobType) ? args.pipes[jobType] : undefined),
  });
  return { runs: runsByMonitorDay(rows), failedMonitorIds };
}

export type RunsRangePipeFn = (params: {
  monitorIds: string[];
  fromDate: number;
  toDate: number;
}) => Promise<{ data: (Counts & { monitorId: string })[] }>;

export type UptimeRunsRangePipes = Record<UptimeQuorumJobType, RunsRangePipeFn>;

export function uptimeRunsRangePipes(tb: OSTinybird): UptimeRunsRangePipes {
  return {
    http: tb.httpRunsRange,
    tcp: tb.tcpRunsRange,
    dns: tb.dnsRunsRange,
    icmp: tb.icmpRunsRange,
    grpc: tb.grpcRunsRange,
  };
}

/**
 * Run verdicts per monitor over [from, to), last ~45 days only. Never throws:
 * a failed chunk (also an endpoint not deployed yet) lands in `failedMonitorIds`.
 */
export async function fetchRunCounts(
  args: Omit<FetchOptions, "monitorIdsByJobType"> & {
    monitors: { id: number; jobType: string; regions: string }[];
    pipes: UptimeRunsRangePipes;
    from: Date;
    to: Date;
  },
): Promise<{ counts: Map<string, Counts>; failedMonitorIds: Set<string> }> {
  const monitorIdsByJobType = new Map<string, Set<string>>();
  for (const m of args.monitors) {
    if (!hasRuns(m.jobType) || quorumRegionCount(m.regions) === null) continue;
    const ids = monitorIdsByJobType.get(m.jobType) ?? new Set<string>();
    ids.add(String(m.id));
    monitorIdsByJobType.set(m.jobType, ids);
  }
  const fromDate = args.from.getTime();
  const toDate = args.to.getTime();
  const { rows, failedMonitorIds } = await fetchChunked({
    ...args,
    monitorIdsByJobType,
    kind: "runs",
    pipeFor: (jobType) => {
      if (!hasRuns(jobType)) return undefined;
      const pipe = args.pipes[jobType];
      return ({ monitorIds }) => pipe({ monitorIds, fromDate, toDate });
    },
  });
  const counts = new Map<string, Counts>();
  for (const { monitorId, ...c } of rows) {
    if (c.ok + c.degraded + c.error <= 0) continue;
    addCounts(counts, monitorId, c);
  }
  return { counts, failedMonitorIds };
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
  runsPipes: UptimeRunsPipes;
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

  const { counts, failedMonitorIds: countsFailed } = await fetchFreezeCounts({
    monitorIdsByJobType,
    pipes: args.pipes,
    sleep: args.sleep,
    onChunkFailure: args.onChunkFailure,
  });
  const failedPipeByMonitorId = new Map<string, FreezePipeKind>();
  for (const id of countsFailed) failedPipeByMonitorId.set(id, "counts");

  // a month frozen without its run verdicts can never get them: a failed runs
  // chunk skips the monitor exactly like a failed counts chunk
  const runs = await fetchRunsByDay({
    monitors: pending.filter((m) => !countsFailed.has(String(m.id))),
    pipes: args.runsPipes,
    sleep: args.sleep,
    onChunkFailure: args.onChunkFailure,
  });
  for (const id of runs.failedMonitorIds) {
    failedPipeByMonitorId.set(id, "runs");
  }

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
    const failedPipe = failedPipeByMonitorId.get(String(m.id));
    if (failedPipe) {
      skipped++;
      failures.push(`monitor ${m.id}: tinybird ${failedPipe} unavailable`);
      continue;
    }

    // no counts in the month (paused, created later, or no status pipe for
    // the job type): nothing to freeze — silent, not a failure
    const computed = computeMonitorMonth({
      month,
      monitorId: m.id,
      counts: countsByMonitorId.get(String(m.id)) ?? [],
      runs: runs.runs.get(String(m.id)),
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
