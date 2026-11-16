import {
  and,
  db as defaultDb,
  eq,
  gt,
  inArray,
  isNull,
  lt,
} from "@openstatus/db";
import {
  monitor,
  monitorSlaExcusedWindow,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  type MonitorSlaSealedWindow,
  monitorSlaSealedMonth,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { monthRange } from "../frozen-uptime/compute";
import { FREEZE_CUTOFF_MS } from "../frozen-uptime/run";
import { withBusyRetry } from "../retry";
import type { Episode } from "./episodes";
import { mergeSpans, type Span } from "./excused";
import {
  excusedWindowMonitorIds,
  type FetchedEpisodes,
  memberTimeMonth,
} from "./internal";
import { completeMonths, coveredSpan } from "./months";
import { storedEpisodes } from "./seal-uptime";

/** A closed month stays open to policy corrections this long before it seals. */
export const SEAL_DELAY_MS = 72 * 3_600_000;

// the zones whose month ends first (UTC+14) and starts last (UTC-12)
const EARLIEST_ZONE = "Pacific/Kiritimati";
const LATEST_ZONE = "Etc/GMT+12";

export type SealMonitorSlaMonthsResult = {
  /** the month sealed, YYYY-MM-01; the same label in every zone that can seal */
  month: string;
  sealed: number;
  /** why no zone could seal; null when some could */
  skipped: "correction-window" | "past-cutoff" | null;
  /** pairs left for the next run because their monitor's checks are not stored up to the month's end yet */
  unavailable: number;
  /** policies of those pairs */
  unavailablePolicyIds: number[];
};

type SealWindow = Span & {
  skipped: SealMonitorSlaMonthsResult["skipped"];
};

function sealWindow(month: string, timeZone: string, now: number): SealWindow {
  const { start, end } = monthRange(month, timeZone);
  const skipped =
    now - start >= FREEZE_CUTOFF_MS
      ? "past-cutoff"
      : now - end < SEAL_DELAY_MS
        ? "correction-window"
        : null;
  return { start, end, skipped };
}

/**
 * Whether no zone can seal `month` now. A zone that can seal it is past its
 * end by SEAL_DELAY_MS, so `month` is its previous month as in UTC.
 */
function noZoneCanSeal(
  month: string,
  now: number,
): SealMonitorSlaMonthsResult["skipped"] {
  if (sealWindow(month, LATEST_ZONE, now).skipped === "past-cutoff") {
    return "past-cutoff";
  }
  if (sealWindow(month, EARLIEST_ZONE, now).skipped === "correction-window") {
    return "correction-window";
  }
  return null;
}

type Pair = {
  workspaceId: number;
  policyId: number;
  timeZone: string;
  target: number;
  strict: boolean;
  monitorId: number;
  memberSince: Date;
};

/**
 * Seals each policy's previous month in its zone SEAL_DELAY_MS after it ended,
 * judged on its monitors' stored episodes. Write-once per (policy, monitor, month); no audit row.
 */
export async function sealMonitorSlaMonths(
  args: {
    db?: DB;
    now?: Date;
    // scope a run (tests, manual retries); default all policies
    policyIds?: number[];
  } = {},
): Promise<SealMonitorSlaMonthsResult> {
  const db = args.db ?? defaultDb;
  const nowDate = args.now ?? new Date();
  const now = nowDate.getTime();
  const [month] = completeMonths(nowDate, 1);
  const skipped = noZoneCanSeal(month, now);
  const idle = {
    month,
    sealed: 0,
    skipped,
    unavailable: 0,
    unavailablePolicyIds: [],
  };
  if (args.policyIds?.length === 0 || skipped !== null) return idle;

  const candidates = await withBusyRetry(() =>
    db
      .select({
        workspaceId: monitorSlaPolicy.workspaceId,
        policyId: monitorSlaPolicy.id,
        timeZone: monitorSlaPolicy.timeZone,
        target: monitorSlaPolicy.target,
        strict: monitorSlaPolicy.strict,
        policyCreatedAt: monitorSlaPolicy.createdAt,
        monitorId: monitor.id,
        memberSince: monitorSlaPolicyToMonitor.createdAt,
      })
      .from(monitorSlaPolicyToMonitor)
      .innerJoin(
        monitorSlaPolicy,
        eq(monitorSlaPolicy.id, monitorSlaPolicyToMonitor.monitorSlaPolicyId),
      )
      .innerJoin(
        monitor,
        and(
          eq(monitor.id, monitorSlaPolicyToMonitor.monitorId),
          eq(monitor.workspaceId, monitorSlaPolicy.workspaceId),
        ),
      )
      .leftJoin(
        monitorSlaSealedMonth,
        and(
          eq(monitorSlaSealedMonth.monitorSlaPolicyId, monitorSlaPolicy.id),
          eq(monitorSlaSealedMonth.monitorId, monitor.id),
          eq(monitorSlaSealedMonth.month, month),
        ),
      )
      .where(
        and(
          args.policyIds
            ? inArray(monitorSlaPolicy.id, args.policyIds)
            : undefined,
          isNull(monitorSlaPolicy.archivedAt),
          isNull(monitor.deletedAt),
          isNull(monitorSlaSealedMonth.id),
        ),
      )
      .all(),
  );

  const windows = new Map<string, SealWindow>();
  const windowOf = (timeZone: string) => {
    let w = windows.get(timeZone);
    if (!w) {
      w = sealWindow(month, timeZone, now);
      windows.set(timeZone, w);
    }
    return w;
  };
  const due: Pair[] = candidates.flatMap(({ policyCreatedAt, ...p }) => {
    const w = windowOf(p.timeZone);
    return w.skipped === null &&
      policyCreatedAt.getTime() < w.end &&
      p.memberSince.getTime() < w.end
      ? [p]
      : [];
  });
  if (due.length === 0) return idle;

  const workspaceRows = await withBusyRetry(() =>
    db
      .select()
      .from(workspace)
      .where(
        inArray(
          workspace.id,
          Array.from(new Set(due.map((p) => p.workspaceId))),
        ),
      )
      .all(),
  );
  const allowed = new Set<number>();
  for (const row of workspaceRows) {
    const parsed = selectWorkspaceSchema.safeParse(row);
    if (parsed.success && parsed.data.limits["monitor-sla"]) {
      allowed.add(parsed.data.id);
    }
  }
  const sealable = due.filter((p) => allowed.has(p.workspaceId));
  if (sealable.length === 0) return idle;

  const byPolicy = new Map<number, Pair[]>();
  for (const p of sealable) {
    const own = byPolicy.get(p.policyId) ?? [];
    own.push(p);
    byPolicy.set(p.policyId, own);
  }
  const windowsOf = await policyWindows(db, [...byPolicy.values()], windowOf);
  const monitorsOfWindow = await withBusyRetry(() =>
    excusedWindowMonitorIds(
      db,
      [...windowsOf.values()].flat().map((w) => w.id),
    ),
  );
  const stored = await storedZoneEpisodes(db, sealable, windowOf);

  const unavailable: number[] = [];
  let sealed = 0;
  for (const [policyId, pairs] of byPolicy) {
    const { workspaceId, timeZone, target, strict } = pairs[0];
    const terms = { target, strict };
    const range = windowOf(timeZone);
    const own = windowsOf.get(policyId) ?? [];
    const zone = stored.get(timeZone);

    const rows: (typeof monitorSlaSealedMonth.$inferInsert)[] = [];
    for (const p of pairs) {
      const covered = coveredSpan(month, timeZone, p.memberSince, now);
      if (!zone || zone.failed.has(p.monitorId)) {
        unavailable.push(policyId);
        continue;
      }
      if (!covered) continue;
      const applied = own.filter((w) =>
        monitorsOfWindow.get(w.id)?.includes(p.monitorId),
      );
      const spans = mergeSpans(
        applied.map((w) => ({ from: new Date(w.from), to: new Date(w.to) })),
      );
      const judged = memberTimeMonth({
        month,
        state: "preview",
        member: { id: p.monitorId, memberSince: p.memberSince },
        fetched: zone,
        excusedSpans: spans,
        terms,
        timeZone,
        now: nowDate,
      });
      if (
        judged.measuredMs === null ||
        judged.downMs === null ||
        judged.excusedMs === null ||
        judged.unmeasuredMs === null
      ) {
        continue;
      }
      rows.push({
        workspaceId,
        monitorSlaPolicyId: policyId,
        monitorId: p.monitorId,
        month,
        timeZone,
        target: terms.target,
        strict: terms.strict,
        excusedWindows: applied,
        uptime: judged.uptime,
        met: judged.met,
        measuredMs: judged.measuredMs,
        downMs: judged.downMs,
        excusedMs: judged.excusedMs,
        unmeasuredMs: judged.unmeasuredMs,
        coverage: judged.coverage,
      });
    }
    for (const row of rows) {
      const inserted = await withBusyRetry(() =>
        db.transaction(async (tx) => {
          // Window adds and removes check for seal rows in their own write
          // transaction, so re-reading the windows here serializes with them.
          const current = await tx
            .select({ id: monitorSlaExcusedWindow.id })
            .from(monitorSlaExcusedWindow)
            .where(
              and(
                eq(monitorSlaExcusedWindow.monitorSlaPolicyId, policyId),
                lt(monitorSlaExcusedWindow.from, new Date(range.end)),
                gt(monitorSlaExcusedWindow.to, new Date(range.start)),
              ),
            )
            .all();
          const counted = new Set(own.map((w) => w.id));
          if (
            current.length !== counted.size ||
            current.some((w) => !counted.has(w.id))
          ) {
            return null;
          }
          const written = await tx
            .insert(monitorSlaSealedMonth)
            .values(row)
            .onConflictDoNothing({
              target: [
                monitorSlaSealedMonth.monitorSlaPolicyId,
                monitorSlaSealedMonth.monitorId,
                monitorSlaSealedMonth.month,
              ],
            })
            .returning({ id: monitorSlaSealedMonth.id });
          return written.length;
        }),
      );
      if (inserted === null) {
        // its windows changed while its month was judged
        unavailable.push(policyId);
        continue;
      }
      sealed += inserted;
    }
  }
  if (unavailable.length > 0) {
    console.warn(
      `monitor-sla seal: checks not stored yet for ${unavailable.length} pairs in ${month}; retried next run`,
    );
  }
  return {
    month,
    sealed,
    skipped: null,
    unavailable: unavailable.length,
    unavailablePolicyIds: [...new Set(unavailable)],
  };
}

/** Each policy's excused windows touching its sealed month, as they are now. */
async function policyWindows(
  db: DB,
  policies: Pair[][],
  windowOf: (timeZone: string) => SealWindow,
): Promise<Map<number, MonitorSlaSealedWindow[]>> {
  const ranges = new Map(
    policies.map((pairs) => [pairs[0].policyId, windowOf(pairs[0].timeZone)]),
  );
  const rows = await withBusyRetry(() =>
    db
      .select()
      .from(monitorSlaExcusedWindow)
      .where(
        and(
          inArray(monitorSlaExcusedWindow.monitorSlaPolicyId, [
            ...ranges.keys(),
          ]),
          lt(
            monitorSlaExcusedWindow.from,
            new Date(Math.max(...[...ranges.values()].map((r) => r.end))),
          ),
          gt(
            monitorSlaExcusedWindow.to,
            new Date(Math.min(...[...ranges.values()].map((r) => r.start))),
          ),
        ),
      )
      .all(),
  );
  const out = new Map<number, MonitorSlaSealedWindow[]>();
  for (const r of rows.sort(
    (a, b) => a.from.getTime() - b.from.getTime() || a.id - b.id,
  )) {
    const range = ranges.get(r.monitorSlaPolicyId);
    if (
      !range ||
      r.from.getTime() >= range.end ||
      r.to.getTime() <= range.start
    ) {
      continue;
    }
    const own = out.get(r.monitorSlaPolicyId) ?? [];
    own.push({
      id: r.id,
      kind: r.kind,
      reason: r.reason,
      from: r.from.getTime(),
      to: r.to.getTime(),
    });
    out.set(r.monitorSlaPolicyId, own);
  }
  return out;
}

/** Per time zone, its monitors' stored episodes over the month; one whose store does not reach the month's end is `failed`. */
async function storedZoneEpisodes(
  db: DB,
  pairs: Pair[],
  windowOf: (timeZone: string) => SealWindow,
): Promise<Map<string, FetchedEpisodes>> {
  const out = new Map<string, FetchedEpisodes>();
  for (const timeZone of new Set(pairs.map((p) => p.timeZone))) {
    const { start, end } = windowOf(timeZone);
    const stored = await storedEpisodes(
      db,
      pairs.filter((p) => p.timeZone === timeZone).map((p) => p.monitorId),
      start,
      end,
    );
    const episodes = new Map<number, Episode[]>();
    const failed = new Set<number>();
    for (const [id, list] of stored) {
      if (list) episodes.set(id, list);
      else failed.add(id);
    }
    out.set(timeZone, { episodes, failed, range: { start, end } });
  }
  return out;
}
