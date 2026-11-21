import { and, db as defaultDb, eq, inArray } from "@openstatus/db";
import { frozenMonitorUptime, monitor } from "@openstatus/db/src/schema";
import type { OSTinybird } from "@openstatus/tinybird";
import { z } from "zod";

import type { DB } from "../context";
import { withBusyRetry } from "../retry";
import { hasBadRanges } from "./buckets";
import { attachBadRanges, type BadBucketRow } from "./compute";
import {
  type ChunkFailure,
  TB_BUCKET_CHUNK_SIZE,
  fetchChunked,
  groupByMonitorId,
  hasRuns,
} from "./run";

export type BackfillBucketRow = BadBucketRow & {
  monitorId: string;
  measure: "requests" | "runs";
};

/** Failing quarter-hours copied from raw Tinybird data for one month. */
export type BackfillBucketPipeFn = (params: {
  month: string;
  monitorIds: string[];
}) => Promise<{ data: BackfillBucketRow[] }>;

export function backfillBucketPipe(tb: OSTinybird): BackfillBucketPipeFn {
  return tb.frozenBad15mBackfill;
}

export const BackfillFrozenBucketsInput = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, "expected YYYY-MM-01"),
  monitorIds: z.array(z.number().int().positive()).min(1).max(1000).optional(),
});
export type BackfillFrozenBucketsInput = z.infer<
  typeof BackfillFrozenBucketsInput
>;

export type BackfillFrozenBucketsResult = {
  month: string;
  updated: number;
  // ranges did not sum to the stored day counts (e.g. raw already pruned)
  mismatched: number;
  // job types without quarter-hour data (heartbeat)
  skipped: number;
  failed: number;
  failures: string[];
};

/**
 * Give frozen rows written without 15-minute ranges their ranges, when those
 * sum exactly to the stored day counts. Counts are never rewritten.
 * System sweep across workspaces, so no ctx: rows are matched by their own id.
 */
export async function backfillFrozenBuckets(
  args: BackfillFrozenBucketsInput & {
    pipe: BackfillBucketPipeFn;
    db?: DB;
    sleep?: (ms: number) => Promise<void>;
    onChunkFailure?: (failure: ChunkFailure) => void;
  },
): Promise<BackfillFrozenBucketsResult> {
  const { month, monitorIds } = BackfillFrozenBucketsInput.parse(args);
  const db = args.db ?? defaultDb;

  const rows = await db
    .select({
      id: frozenMonitorUptime.id,
      monitorId: frozenMonitorUptime.monitorId,
      days: frozenMonitorUptime.days,
      jobType: monitor.jobType,
    })
    .from(frozenMonitorUptime)
    .innerJoin(monitor, eq(monitor.id, frozenMonitorUptime.monitorId))
    .where(
      and(
        eq(frozenMonitorUptime.month, month),
        monitorIds
          ? inArray(frozenMonitorUptime.monitorId, monitorIds)
          : undefined,
      ),
    );

  const missing = rows.filter((r) => !hasBadRanges(r.days));
  const pending = missing.filter((r) => hasRuns(r.jobType));
  const result: BackfillFrozenBucketsResult = {
    month,
    updated: 0,
    mismatched: 0,
    skipped: rows.filter((r) => !hasRuns(r.jobType)).length,
    failed: 0,
    failures: [],
  };

  const monitorIdsByJobType = new Map<string, Set<string>>();
  for (const r of pending) {
    const ids = monitorIdsByJobType.get(r.jobType) ?? new Set<string>();
    ids.add(String(r.monitorId));
    monitorIdsByJobType.set(r.jobType, ids);
  }
  const fetched = await fetchChunked<BackfillBucketRow>({
    monitorIdsByJobType,
    chunkSize: TB_BUCKET_CHUNK_SIZE,
    kind: "backfill",
    pipeFor: () => (params) =>
      args.pipe({ month, monitorIds: params.monitorIds }),
    sleep: args.sleep,
    onChunkFailure: args.onChunkFailure,
  });
  const bucketsByMonitorId = groupByMonitorId(fetched.rows);

  for (const r of pending) {
    if (fetched.failedMonitorIds.has(String(r.monitorId))) {
      result.failed++;
      result.failures.push(
        `monitor ${r.monitorId}: tinybird backfill unavailable`,
      );
      continue;
    }
    const buckets = bucketsByMonitorId.get(String(r.monitorId)) ?? [];
    // a month frozen before run verdicts existed has nothing to check runs against
    const hasRunCounts = r.days.some((d) => d.runs);
    const attached = attachBadRanges(r.days, {
      requests: buckets.filter((b) => b.measure === "requests"),
      runs: hasRunCounts ? buckets.filter((b) => b.measure === "runs") : [],
    });
    if (attached.bucketMismatch) {
      result.mismatched++;
      console.warn(
        `uptime-backfill: monitor ${r.monitorId} ${month} bad ranges do not match the day counts, left without them`,
      );
      continue;
    }

    try {
      const written = await withBusyRetry(() =>
        db
          .update(frozenMonitorUptime)
          .set({ days: attached.days })
          .where(
            and(
              eq(frozenMonitorUptime.id, r.id),
              // a re-freeze since the read wins: its counts are newer
              eq(frozenMonitorUptime.days, r.days),
            ),
          )
          .returning({ id: frozenMonitorUptime.id }),
      );
      if (written.length > 0) result.updated++;
    } catch (e) {
      result.failed++;
      result.failures.push(
        `monitor ${r.monitorId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return result;
}
