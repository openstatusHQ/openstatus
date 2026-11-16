import {
  and,
  db as defaultDb,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
} from "@openstatus/db";
import {
  monitor,
  uptimeTarget,
  uptimeTargetToMonitor,
  monitorUptimeEpisode,
  monitorUptimeWatermark,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import { uptimeTargetJobTypes } from "@openstatus/db/src/schema/uptime_targets/constants";

import { type DB, defaultTb } from "../context";
import { withBusyRetry } from "../retry";
import type { Episode } from "./episodes";
import {
  clipEpisodes,
  type EpisodeMonitor,
  fetchUptimeEpisodes,
  type UptimeEpisodesPipes,
  uptimeEpisodesPipes,
} from "./fetch-episodes";

const HOUR_MS = 3_600_000;

/** Checks are stored this long after they ran, so late results and the next checks are in. */
export const UPTIME_SEAL_LAG_MS = 24 * HOUR_MS;
/** Checks read before the sealed range, so its first ones are weighted by their neighbours. */
export const UPTIME_SEAL_MARGIN_MS = 24 * HOUR_MS;
/** The longest range one run reads; the run view keeps 45 days. */
export const UPTIME_SEAL_MAX_RANGE_MS = 40 * 24 * HOUR_MS;

const ID_CHUNK = 500;
const EPISODE_INSERT_CHUNK = 500;

type Watermark = { sealedFrom: number; sealedUntil: number };

function mergeAdjacent(episodes: readonly Episode[]): Episode[] {
  const out: Episode[] = [];
  for (const e of episodes) {
    if (e.endedAt <= e.startedAt) continue;
    const last = out.at(-1);
    if (last && last.kind === e.kind && last.endedAt === e.startedAt) {
      last.endedAt = e.endedAt;
    } else {
      out.push({ ...e });
    }
  }
  return out;
}

/**
 * A monitor's stored episodes clipped to [fromMs, toMs), as a tiling of it:
 * the time before the store begins, and any hole the rows leave, is
 * unmeasured. Null when the watermark does not reach `toMs`.
 */
export function tileStoredEpisodes(args: {
  watermark: Watermark | undefined;
  rows: readonly Episode[];
  fromMs: number;
  toMs: number;
}): Episode[] | null {
  const { watermark, fromMs, toMs } = args;
  if (!watermark || watermark.sealedUntil < toMs) return null;
  if (toMs <= fromMs) return [];
  const out: Episode[] = [];
  let cursor = fromMs;
  const rows = [...args.rows].sort((a, b) => a.startedAt - b.startedAt);
  for (const r of rows) {
    const start = Math.max(r.startedAt, cursor, watermark.sealedFrom);
    const end = Math.min(r.endedAt, toMs);
    if (end <= start) continue;
    out.push({ kind: "unmeasured", startedAt: cursor, endedAt: start });
    out.push({ kind: r.kind, startedAt: start, endedAt: end });
    cursor = end;
  }
  out.push({ kind: "unmeasured", startedAt: cursor, endedAt: toMs });
  return mergeAdjacent(out);
}

function chunked<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** Per monitor, its stored episodes tiling [fromMs, toMs), or null while the store does not reach `toMs`. */
export async function storedEpisodes(
  db: DB,
  monitorIds: readonly number[],
  fromMs: number,
  toMs: number,
): Promise<Map<number, Episode[] | null>> {
  const ids = [...new Set(monitorIds)];
  const watermarks = new Map<number, Watermark>();
  const rows = new Map<number, Episode[]>();
  for (const part of chunked(ids, ID_CHUNK)) {
    const [marks, episodes] = await withBusyRetry(() =>
      Promise.all([
        db
          .select()
          .from(monitorUptimeWatermark)
          .where(inArray(monitorUptimeWatermark.monitorId, part))
          .all(),
        db
          .select()
          .from(monitorUptimeEpisode)
          .where(
            and(
              inArray(monitorUptimeEpisode.monitorId, part),
              lt(monitorUptimeEpisode.startedAt, toMs),
              gt(monitorUptimeEpisode.endedAt, fromMs),
            ),
          )
          .all(),
      ]),
    );
    for (const m of marks) watermarks.set(m.monitorId, m);
    for (const e of episodes) {
      const list = rows.get(e.monitorId);
      if (list) list.push(e);
      else rows.set(e.monitorId, [e]);
    }
  }
  return new Map(
    ids.map((id) => [
      id,
      tileStoredEpisodes({
        watermark: watermarks.get(id),
        rows: rows.get(id) ?? [],
        fromMs,
        toMs,
      }),
    ]),
  );
}

export type SealMonitorUptimeResult = {
  /** monitors whose watermark advanced */
  sealed: number;
  /** monitors left for the next run because their checks could not be read */
  failed: number;
  /** monitors with nothing new to store, or stored by an overlapping run */
  skipped: number;
};

type Due = EpisodeMonitor & {
  workspaceId: number;
  watermark: Watermark | undefined;
  from: number;
  /** unmeasured time between the watermark and the oldest checks still readable */
  gap: Episode | null;
};

/** What a monitor's next seal covers; null when it is up to date. */
export function uptimeSealRange(args: {
  watermark: Watermark | undefined;
  createdAt: number;
  until: number;
}): { from: number; gap: Episode | null } | null {
  const { watermark, until } = args;
  const oldest = until - UPTIME_SEAL_MAX_RANGE_MS;
  if (!watermark) {
    const from = Math.max(args.createdAt, oldest);
    return until <= from ? null : { from, gap: null };
  }
  if (until <= watermark.sealedUntil) return null;
  if (watermark.sealedUntil >= oldest) {
    return { from: watermark.sealedUntil, gap: null };
  }
  return {
    from: oldest,
    gap: {
      kind: "unmeasured",
      startedAt: watermark.sealedUntil,
      endedAt: oldest,
    },
  };
}

/** The episodes of [from, until) to store, a long gap's unmeasured time first. */
export function uptimeEpisodesToStore(args: {
  episodes: readonly Episode[];
  gap: Episode | null;
  from: number;
  until: number;
}): Episode[] {
  const clipped = clipEpisodes(args.episodes, args.from, args.until);
  return mergeAdjacent(args.gap ? [args.gap, ...clipped] : clipped);
}

/**
 * Stores the checks of every monitor in an uptime target that is not archived,
 * up to UPTIME_SEAL_LAG_MS ago: once per monitor however many uptime targets
 * it is in. A system job: no ctx, no audit row.
 */
export async function sealMonitorUptime(
  args: {
    db?: DB;
    now?: Date;
    // scope a run (tests, manual retries); default every monitor in an uptime target
    monitorIds?: number[];
    episodesPipes?: UptimeEpisodesPipes;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<SealMonitorUptimeResult> {
  const db = args.db ?? defaultDb;
  const now = (args.now ?? new Date()).getTime();
  // on the hour, so the monitors of one run share a range and a pipe call
  const until = Math.floor((now - UPTIME_SEAL_LAG_MS) / HOUR_MS) * HOUR_MS;
  const result: SealMonitorUptimeResult = { sealed: 0, failed: 0, skipped: 0 };
  if (args.monitorIds?.length === 0) return result;

  const candidates = await withBusyRetry(() =>
    db
      .selectDistinct({
        id: monitor.id,
        workspaceId: monitor.workspaceId,
        jobType: monitor.jobType,
        regions: monitor.regions,
        periodicity: monitor.periodicity,
        createdAt: monitor.createdAt,
        sealedFrom: monitorUptimeWatermark.sealedFrom,
        sealedUntil: monitorUptimeWatermark.sealedUntil,
      })
      .from(uptimeTargetToMonitor)
      .innerJoin(
        uptimeTarget,
        eq(uptimeTarget.id, uptimeTargetToMonitor.uptimeTargetId),
      )
      .innerJoin(
        monitor,
        and(
          eq(monitor.id, uptimeTargetToMonitor.monitorId),
          eq(monitor.workspaceId, uptimeTarget.workspaceId),
        ),
      )
      .leftJoin(
        monitorUptimeWatermark,
        eq(monitorUptimeWatermark.monitorId, monitor.id),
      )
      .where(
        and(
          args.monitorIds ? inArray(monitor.id, args.monitorIds) : undefined,
          isNull(uptimeTarget.archivedAt),
          inArray(monitor.jobType, [...uptimeTargetJobTypes]),
          isNull(monitor.deletedAt),
        ),
      )
      .all(),
  );

  const allowed = new Set<number>();
  const workspaceIds = [
    ...new Set(candidates.flatMap((m) => m.workspaceId ?? [])),
  ];
  for (const part of chunked(workspaceIds, ID_CHUNK)) {
    const rows = await withBusyRetry(() =>
      db.select().from(workspace).where(inArray(workspace.id, part)).all(),
    );
    for (const row of rows) {
      const parsed = selectWorkspaceSchema.safeParse(row);
      if (parsed.success && parsed.data.limits["uptime-targets"]) {
        allowed.add(parsed.data.id);
      }
    }
  }

  const groups = new Map<number, Due[]>();
  for (const m of candidates) {
    if (m.workspaceId === null || !allowed.has(m.workspaceId)) continue;
    const watermark =
      m.sealedFrom !== null && m.sealedUntil !== null
        ? { sealedFrom: m.sealedFrom, sealedUntil: m.sealedUntil }
        : undefined;
    const range = uptimeSealRange({
      watermark,
      createdAt: m.createdAt?.getTime() ?? 0,
      until,
    });
    if (!range) {
      result.skipped++;
      continue;
    }
    const readFrom =
      Math.floor((range.from - UPTIME_SEAL_MARGIN_MS) / HOUR_MS) * HOUR_MS;
    const group = groups.get(readFrom) ?? [];
    group.push({ ...m, workspaceId: m.workspaceId, watermark, ...range });
    groups.set(readFrom, group);
  }

  for (const [readFrom, group] of groups) {
    const fetched = await fetchUptimeEpisodes({
      monitors: group,
      fromMs: readFrom,
      toMs: now,
      pipes: () => args.episodesPipes ?? uptimeEpisodesPipes(defaultTb),
      sleep: args.sleep,
    });
    for (const m of group) {
      if (fetched.failed.has(m.id)) {
        result.failed++;
        continue;
      }
      const episodes = uptimeEpisodesToStore({
        // a monitor that was not read has no run verdicts
        episodes: fetched.episodes.get(m.id) ?? [
          { kind: "unmeasured", startedAt: readFrom, endedAt: now },
        ],
        gap: m.gap,
        from: m.from,
        until,
      });
      const stored = await withBusyRetry(() =>
        db.transaction((tx) => storeUptime(tx, m, episodes, until)),
      );
      if (stored) result.sealed++;
      else result.skipped++;
    }
  }
  if (result.failed > 0) {
    console.warn(
      `monitor-uptime seal: checks unavailable for ${result.failed} monitors; retried next run`,
    );
  }
  return result;
}

/** Advances the watermark from the value this run read, then writes the episodes; false when another run got there first. */
async function storeUptime(
  tx: DB,
  m: Due,
  episodes: readonly Episode[],
  until: number,
): Promise<boolean> {
  const moved = m.watermark
    ? await tx
        .update(monitorUptimeWatermark)
        .set({ sealedUntil: until, updatedAt: new Date() })
        .where(
          and(
            eq(monitorUptimeWatermark.monitorId, m.id),
            eq(monitorUptimeWatermark.sealedUntil, m.watermark.sealedUntil),
          ),
        )
        .returning({ monitorId: monitorUptimeWatermark.monitorId })
    : await tx
        .insert(monitorUptimeWatermark)
        .values({
          monitorId: m.id,
          workspaceId: m.workspaceId,
          sealedFrom: m.from,
          sealedUntil: until,
        })
        .onConflictDoNothing({ target: monitorUptimeWatermark.monitorId })
        .returning({ monitorId: monitorUptimeWatermark.monitorId });
  if (moved.length === 0) return false;

  let rest = episodes;
  const [first] = episodes;
  if (first && m.watermark) {
    const previous = await tx
      .select()
      .from(monitorUptimeEpisode)
      .where(eq(monitorUptimeEpisode.monitorId, m.id))
      .orderBy(desc(monitorUptimeEpisode.startedAt))
      .limit(1)
      .get();
    if (
      previous &&
      previous.kind === first.kind &&
      previous.endedAt === first.startedAt
    ) {
      await tx
        .update(monitorUptimeEpisode)
        .set({ endedAt: first.endedAt })
        .where(eq(monitorUptimeEpisode.id, previous.id));
      rest = episodes.slice(1);
    }
  }
  const rows = rest.map((e) => ({
    workspaceId: m.workspaceId,
    monitorId: m.id,
    ...e,
  }));
  for (const part of chunked(rows, EPISODE_INSERT_CHUNK)) {
    await tx.insert(monitorUptimeEpisode).values(part);
  }
  return true;
}
