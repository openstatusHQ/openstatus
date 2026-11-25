import {
  and,
  db as defaultDb,
  eq,
  gte,
  inArray,
  isNull,
  or,
} from "@openstatus/db";
import {
  frozenMonitorUptime,
  type MonitorJobType,
  monitor,
  selectWorkspaceSchema,
  type Workspace,
  workspace,
} from "@openstatus/db/src/schema";
import type { OSTinybird } from "@openstatus/tinybird";

import type { DB } from "../context";
import {
  type BadBucketRow,
  type ComputeCountRow,
  computeMonitorMonth,
  monthRange,
  previousMonth,
} from "./compute";
import { freezeMonitorMonth } from "./freeze";
import { quorumRegionCount, type RunsByDay, runsByMonitorDay } from "./quorum";
import { RefreezeMonitorMonthsInput } from "./schemas";

type PipeFn<Row> = (params: {
  monitorIds: string[];
  days?: number;
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

type UptimeQuorumJobType = Exclude<
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
export function countsRuns(m: {
  jobType: string;
  regions: string | readonly string[];
}): boolean {
  return hasRuns(m.jobType) && quorumRegionCount(m.regions) !== null;
}

/** Failing quarter-hours of the month, `[fromDate, toDate)` in epoch ms. */
export type BadBucketPipeFn = (params: {
  monitorIds: string[];
  fromDate: number;
  toDate: number;
}) => Promise<{ data: (BadBucketRow & { monitorId: string })[] }>;

// heartbeat has no 15m view and no runs: its rows never get bad ranges
export type UptimeBadBucketPipes = {
  requests: Record<UptimeQuorumJobType, BadBucketPipeFn>;
  runs: Record<UptimeQuorumJobType, BadBucketPipeFn>;
};

export function uptimeBadBucketPipes(tb: OSTinybird): UptimeBadBucketPipes {
  return {
    requests: {
      http: tb.httpStatusBad15m,
      tcp: tb.tcpStatusBad15m,
      dns: tb.dnsStatusBad15m,
      icmp: tb.icmpStatusBad15m,
      grpc: tb.grpcStatusBad15m,
    },
    runs: {
      http: tb.httpRunsBad15m,
      tcp: tb.tcpRunsBad15m,
      dns: tb.dnsRunsBad15m,
      icmp: tb.icmpRunsBad15m,
      grpc: tb.grpcRunsBad15m,
    },
  };
}

export type FreezePipeKind =
  | "counts"
  | "runs"
  | "badRequests"
  | "badRuns"
  | "backfill";

export type ChunkFailure = {
  pipe: FreezePipeKind;
  jobType: string;
  monitorIds: string[];
  error: unknown;
};

// zod-bird sends monitorIds as one comma-joined GET query param — unbounded
// batches risk URL-length 400s
const TB_CHUNK_SIZE = 200;
// a monitor failing all month returns 96 rows per day per measure
export const TB_BUCKET_CHUNK_SIZE = 25;
const TB_ATTEMPTS = 3;
// spacing between chunk requests: keeps the monthly sweep from bursting TB
// (zod-bird already absorbs 429/5xx with its own internal retries)
const TB_THROTTLE_MS = 250;

// the status pipes look back a fixed 45 days; past monthStart + 45d the
// earliest month days return no rows and would freeze as permanent zeros
export const FREEZE_CUTOFF_MS = 45 * 86_400_000;

// the pipes count back from Tinybird's today; one day of slack over the cutoff
// keeps the first month day in the read even if the guard and TB straddle midnight
const FREEZE_WINDOW_DAYS = FREEZE_CUTOFF_MS / 86_400_000 + 1;

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
  // omitted: the pipe's own 45-day default
  days?: number;
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
          const res = await pipe(
            args.days === undefined
              ? { monitorIds }
              : { monitorIds, days: args.days },
          );
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

/**
 * Failing quarter-hours of the month per monitor and measure. A failed chunk
 * skips its monitors, so the next run freezes them with their ranges.
 */
async function fetchBadBuckets(
  args: Omit<FetchOptions, "monitorIdsByJobType"> & {
    badPipes: UptimeBadBucketPipes;
    month: string;
    monitors: { id: number; jobType: string; regions: string }[];
  },
) {
  const { start, end } = monthRange(args.month);
  const byJobType = (monitors: typeof args.monitors) => {
    const out = new Map<string, Set<string>>();
    for (const m of monitors) {
      if (!hasRuns(m.jobType)) continue;
      const ids = out.get(m.jobType) ?? new Set<string>();
      ids.add(String(m.id));
      out.set(m.jobType, ids);
    }
    return out;
  };
  const fetchMeasure = (
    kind: "badRequests" | "badRuns",
    pipes: Record<UptimeQuorumJobType, BadBucketPipeFn>,
    monitors: typeof args.monitors,
  ) =>
    fetchChunked({
      ...args,
      chunkSize: args.chunkSize ?? TB_BUCKET_CHUNK_SIZE,
      monitorIdsByJobType: byJobType(monitors),
      kind,
      pipeFor: (jobType) =>
        hasRuns(jobType)
          ? ({ monitorIds }) =>
              pipes[jobType]({ monitorIds, fromDate: start, toDate: end })
          : undefined,
    });

  const requests = await fetchMeasure(
    "badRequests",
    args.badPipes.requests,
    args.monitors,
  );
  const runs = await fetchMeasure(
    "badRuns",
    args.badPipes.runs,
    args.monitors.filter(
      (m) => countsRuns(m) && !requests.failedMonitorIds.has(String(m.id)),
    ),
  );

  const failedPipeByMonitorId = new Map<string, FreezePipeKind>();
  for (const id of requests.failedMonitorIds) {
    failedPipeByMonitorId.set(id, "badRequests");
  }
  for (const id of runs.failedMonitorIds) {
    failedPipeByMonitorId.set(id, "badRuns");
  }
  return {
    requests: groupByMonitorId(requests.rows),
    runs: groupByMonitorId(runs.rows),
    failedPipeByMonitorId,
  };
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
  // frozen without bad ranges because they did not add up to the day counts
  bucketMismatch: number;
  failures: string[];
  // set when the month is still inside the hold and nothing was attempted
  held?: true;
};

// late check results keep landing in Tinybird for a while after the month ends
const FREEZE_HOLD_MS = 48 * 3_600_000;

/** Epoch ms after which Tinybird no longer covers the whole month. */
export function freezeCutoff(month: string): number {
  return monthRange(month).start + FREEZE_CUTOFF_MS;
}

function emptyResult(month: string, failures: string[] = []) {
  return {
    month,
    frozen: 0,
    alreadyFrozen: 0,
    skipped: 0,
    bucketMismatch: 0,
    failures,
  };
}

// null when the month may be frozen now, else the result to return unchanged
function guardMonth(
  month: string,
  now: Date,
  force: boolean,
): RunUptimeFreezeResult | null {
  // refuse instead of writing wrong zeros into the frozen table; the failure
  // surfaces via the cron's reportBackgroundError
  if (now.getTime() >= freezeCutoff(month)) {
    return emptyResult(month, [
      `month ${month}: past the 45d Tinybird window — freezing now would write permanent zero-count days`,
    ]);
  }
  // force skips the hold, never the month end: a row frozen early keeps zero
  // days for good, the daily run counts it as already frozen
  if (now.getTime() < monthRange(month).end) {
    return {
      ...emptyResult(month, [`month ${month}: has not ended yet`]),
      held: true,
    };
  }
  if (!force && now.getTime() < monthRange(month).end + FREEZE_HOLD_MS) {
    return { ...emptyResult(month), held: true };
  }
  return null;
}

type FreezeMonthArgs = {
  db: DB;
  month: string;
  pipes: UptimeFreezePipes;
  runsPipes: UptimeRunsPipes;
  badPipes?: UptimeBadBucketPipes;
  monitorIds?: number[];
  sleep?: (ms: number) => Promise<void>;
  onChunkFailure?: (failure: ChunkFailure) => void;
  // false: write-once, frozen monitors are skipped; true: upsert over them
  replace: boolean;
};

async function freezeMonth(
  args: FreezeMonthArgs,
): Promise<RunUptimeFreezeResult> {
  const { db, month } = args;
  const monthStart = new Date(monthRange(month).start);

  // regardless of page attachment — months without counts are dropped by
  // computeMonitorMonth anyway; deleted during the month still ran part of it
  const monitorRows = await db
    .select({
      id: monitor.id,
      workspaceId: monitor.workspaceId,
      jobType: monitor.jobType,
      regions: monitor.regions,
      active: monitor.active,
      updatedAt: monitor.updatedAt,
      deletedAt: monitor.deletedAt,
    })
    .from(monitor)
    .where(
      and(
        or(isNull(monitor.deletedAt), gte(monitor.deletedAt, monthStart)),
        args.monitorIds ? inArray(monitor.id, args.monitorIds) : undefined,
      ),
    );
  // inactive + untouched since before the month ⇒ it was inactive the whole
  // month (pausing bumps updatedAt), so skip the TB fetch; soft-delete sets
  // active=false without touching updatedAt, so deleted rows always go to TB
  const monitors = monitorRows.flatMap((m) =>
    m.workspaceId === null ||
    (!m.active &&
      m.deletedAt === null &&
      m.updatedAt !== null &&
      m.updatedAt < monthStart)
      ? []
      : [{ ...m, workspaceId: m.workspaceId }],
  );

  // re-runs only work the monitors that failed last time: those with a frozen
  // row for this month are excluded before any TB fetch (the insert's
  // onConflictDoNothing stays as the race backstop)
  const frozenMonitorIds = new Set<number>();
  if (!args.replace) {
    const frozenRows = await db
      .select({ monitorId: frozenMonitorUptime.monitorId })
      .from(frozenMonitorUptime)
      .where(
        and(
          eq(frozenMonitorUptime.month, month),
          args.monitorIds
            ? inArray(frozenMonitorUptime.monitorId, args.monitorIds)
            : undefined,
        ),
      );
    for (const r of frozenRows) frozenMonitorIds.add(r.monitorId);
  }

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
    days: FREEZE_WINDOW_DAYS,
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
    days: FREEZE_WINDOW_DAYS,
    sleep: args.sleep,
    onChunkFailure: args.onChunkFailure,
  });
  for (const id of runs.failedMonitorIds) {
    failedPipeByMonitorId.set(id, "runs");
  }

  // avoid an O(pending²) sweep: computeMonitorMonth scans linearly per call
  const countsByMonitorId = groupByMonitorId(counts);

  const bad = args.badPipes
    ? await fetchBadBuckets({
        badPipes: args.badPipes,
        month,
        // a monitor without counts gets no row, so its buckets are never used
        monitors: pending.filter(
          (m) =>
            !failedPipeByMonitorId.has(String(m.id)) &&
            countsByMonitorId.has(String(m.id)),
        ),
        sleep: args.sleep,
        onChunkFailure: args.onChunkFailure,
      })
    : undefined;
  for (const [id, kind] of bad?.failedPipeByMonitorId ?? []) {
    failedPipeByMonitorId.set(id, kind);
  }

  const workspaces = await workspacesById(
    db,
    pending.map((m) => m.workspaceId),
  );

  let frozen = 0;
  let skipped = 0;
  let bucketMismatch = 0;
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
      bad: hasRuns(m.jobType)
        ? bad && {
            requests: bad.requests.get(String(m.id)) ?? [],
            runs: bad.runs.get(String(m.id)) ?? [],
          }
        : undefined,
    });
    if (!computed) {
      // a re-freeze names its monitors: say when one kept its old row
      if (args.replace) {
        failures.push(`monitor ${m.id}: no counts in Tinybird, row unchanged`);
      }
      continue;
    }
    if (computed.bucketMismatch) {
      bucketMismatch++;
      console.warn(
        `uptime-freeze: monitor ${m.id} ${month} bad ranges do not match the day counts, frozen without them`,
      );
    }

    const ws = workspaces.get(m.workspaceId);
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
      const written = await freezeMonitorMonth({
        ctx,
        input: {
          monitorId: m.id,
          month,
          days: computed.days,
        },
        replace: args.replace,
      });
      if (written) frozen++;
      else alreadyFrozen++;
    } catch (e) {
      failures.push(
        `monitor ${m.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return { month, frozen, alreadyFrozen, skipped, bucketMismatch, failures };
}

export async function workspacesById(
  db: DB,
  ids: number[],
): Promise<Map<number, Workspace>> {
  const unique = [...new Set(ids)];
  const rows =
    unique.length > 0
      ? await db.select().from(workspace).where(inArray(workspace.id, unique))
      : [];
  return new Map(rows.map((w) => [w.id, selectWorkspaceSchema.parse(w)]));
}

type FreezeRunOptions = {
  pipes: UptimeFreezePipes;
  runsPipes: UptimeRunsPipes;
  // omitted: rows are frozen without bad ranges
  badPipes?: UptimeBadBucketPipes;
  now?: Date;
  db?: DB;
  // freeze before the 48h hold has passed
  force?: boolean;
  sleep?: (ms: number) => Promise<void>;
  onChunkFailure?: (failure: ChunkFailure) => void;
};

/**
 * Freeze the previous calendar month for every monitor that existed in it.
 * Pipes (and optionally db/now) are injected so the cron stays a thin
 * env/Sentry wrapper and this orchestration is unit-testable.
 */
export async function runUptimeFreeze(
  args: FreezeRunOptions & {
    monitorIds?: number[]; // scope a run (tests, manual retries); default all
  },
): Promise<RunUptimeFreezeResult> {
  const now = args.now ?? new Date();
  const month = previousMonth(now);
  const held = guardMonth(month, now, args.force ?? false);
  if (held) return held;
  return freezeMonth({
    ...args,
    db: args.db ?? defaultDb,
    month,
    replace: false,
  });
}

/**
 * Recompute and overwrite the frozen rows of the given monitors for one month.
 * A monitor whose Tinybird read fails keeps its existing row.
 */
export async function refreezeMonitorMonths(
  args: FreezeRunOptions & RefreezeMonitorMonthsInput,
): Promise<RunUptimeFreezeResult> {
  const { month, monitorIds } = RefreezeMonitorMonthsInput.parse(args);
  const now = args.now ?? new Date();
  const held = guardMonth(month, now, args.force ?? false);
  if (held) return held;
  return freezeMonth({
    ...args,
    db: args.db ?? defaultDb,
    month,
    monitorIds,
    replace: true,
  });
}
