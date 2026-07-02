import { and, db as defaultDb, eq, inArray, isNull } from "@openstatus/db";
import {
  frozenMonitorUptime,
  monitor,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import {
  type ComputeCountRow,
  computeMonitorMonth,
  monthRange,
  previousMonth,
} from "./compute";
import { freezeMonitorMonth } from "./freeze";

export type StatusPipeFn = (params: {
  monitorIds: string[];
}) => Promise<{ data: ComputeCountRow[] }>;

// only these job types have a 45d status pipe; others (icmp/udp/ssl) have no
// counts on the live status page either and are skipped
export type UptimeFreezePipes = Record<"http" | "tcp" | "dns", StatusPipeFn>;

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
const FREEZE_CUTOFF_MS = 45 * 86_400_000;

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error(`chunk size must be positive, got ${size}`);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function hasStatusPipe(
  jobType: string | null | undefined,
): jobType is keyof UptimeFreezePipes {
  return jobType === "http" || jobType === "tcp" || jobType === "dns";
}

/**
 * Fetch daily counts for all monitors, chunked and retried. Monitors whose
 * chunk still fails after retries land in `failedMonitorIds` — they are
 * skipped (never frozen with silent zeros) and picked up by a re-run.
 */
export async function fetchFreezeCounts(args: {
  monitorIdsByJobType: Map<string, Set<string>>;
  pipes: UptimeFreezePipes;
  chunkSize?: number;
  attempts?: number;
  throttleMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onChunkFailure?: (failure: ChunkFailure) => void;
}): Promise<{ counts: ComputeCountRow[]; failedMonitorIds: Set<string> }> {
  const chunkSize = args.chunkSize ?? TB_CHUNK_SIZE;
  const attempts = args.attempts ?? TB_ATTEMPTS;
  const throttleMs = args.throttleMs ?? TB_THROTTLE_MS;
  const sleep =
    args.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  const counts: ComputeCountRow[] = [];
  const failedMonitorIds = new Set<string>();
  let firstChunk = true;

  for (const [jobType, ids] of args.monitorIdsByJobType) {
    if (!hasStatusPipe(jobType)) continue;
    const pipe = args.pipes[jobType];
    for (const monitorIds of chunk([...ids], chunkSize)) {
      if (!firstChunk && throttleMs > 0) await sleep(throttleMs);
      firstChunk = false;
      let lastError: unknown;
      let done = false;
      for (let attempt = 0; attempt < attempts && !done; attempt++) {
        try {
          if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
          const res = await pipe({ monitorIds });
          counts.push(...res.data);
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

  return { counts, failedMonitorIds };
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

  // avoid an O(pending²) sweep: computeMonitorMonth scans linearly per call
  const countsByMonitorId = new Map<string, ComputeCountRow[]>();
  for (const row of counts) {
    const rows = countsByMonitorId.get(row.monitorId);
    if (rows) rows.push(row);
    else countsByMonitorId.set(row.monitorId, [row]);
  }

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
    const computed = computeMonitorMonth({
      month,
      monitorId: m.id,
      counts: countsByMonitorId.get(String(m.id)) ?? [],
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
