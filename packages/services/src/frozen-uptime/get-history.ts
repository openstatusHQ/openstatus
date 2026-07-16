import { and, eq, gte, inArray } from "@openstatus/db";
import {
  frozenMonitorUptime,
  pageConfigurationSchema,
} from "@openstatus/db/src/schema";

import { type ServiceContext, defaultTb, getReadDb } from "../context";
import { ForbiddenError, NotFoundError } from "../errors";
import {
  type Event,
  dayCoverage,
  durationDowntimeMs,
  floorPct,
  getEvents,
  reportsOnlyDowntimeMs,
  requestsTally,
} from "../status-timeline";
import { type ComputeCountRow, monthRange } from "./compute";
import { type UptimeFreezePipes, fetchFreezeCounts } from "./run";
import { GetUptimeHistoryInput } from "./schemas";

const HISTORY_MONTHS = 24;

const WINDOWS = [6, 12, 24] as const;
type HistoryWindowKey = "6" | "12" | "24";

// safe because HistoryWindowKey is exactly the string form of each WINDOWS entry
function windowKey(w: (typeof WINDOWS)[number]): HistoryWindowKey {
  return String(w) as HistoryWindowKey;
}

type DayCount = { day: string; ok: number; degraded: number; error: number };

// native-unit numerators kept alongside the percentage so rolling windows
// stay additive (checks for requests mode, milliseconds for event math);
// averaging monthly percentages would weigh a 2-day month like a full one
type MonthValue = { percentage: number; up: number; total: number } | null;

type UptimeHistoryEvent = Pick<
  Event,
  "id" | "name" | "type" | "status" | "from" | "to"
>;

type UptimeHistoryRow = {
  component: {
    id: number;
    name: string;
    type: "monitor" | "static";
    /** for event links, null for static components */
    monitorId: number | null;
  };
  /** "YYYY-MM" → percentage; null = no data recorded, NEVER "down" */
  months: Record<string, number | null>;
  rolling: Record<HistoryWindowKey, number | null>;
  /** component events in the window; clients bucket per month by overlap */
  events: UptimeHistoryEvent[];
};

type UptimeHistoryResult = {
  mode: "requests" | "duration" | "manual";
  /** oldest → newest, length HISTORY_MONTHS, last entry = current month */
  months: string[];
  createdAt: Date | null;
  summary: Record<HistoryWindowKey, { uptime: number | null; reports: number }>;
  rows: UptimeHistoryRow[];
};

function monthKeys(now: Date): string[] {
  return Array.from({ length: HISTORY_MONTHS }, (_, i) => {
    const d = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - (HISTORY_MONTHS - 1 - i),
        1,
      ),
    );
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${d.getUTCFullYear()}-${mm}`;
  });
}

function requestsMonth(days: DayCount[] | null): MonthValue {
  if (!days) return null;
  const { up, total } = requestsTally(days);
  if (total === 0) return null;
  return { percentage: floorPct(up / total), up, total };
}

function durationMonth(
  days: DayCount[] | null,
  events: Event[],
  nowMs: number,
): MonthValue {
  // denominator = days with checks, matching getUptime's data.length; frozen
  // months are zero-filled so counting all days would inflate sparse months
  const withChecks = (days ?? []).filter(
    (d) => d.ok + d.degraded + d.error > 0,
  );
  if (withChecks.length === 0) return null;
  // downtime is clipped to the checked days (a paused stretch can't exceed
  // the denominator) and the in-progress day is clamped to elapsed time so
  // 2h down on the 2nd isn't diluted by the rest of today
  const dayStarts = withChecks.map((d) => Date.parse(`${d.day}T00:00:00.000Z`));
  const { segments, totalMs } = dayCoverage(dayStarts, nowMs);
  if (segments.length === 0 || totalMs <= 0) return null;
  const window = {
    start: segments[0].start,
    end: segments[segments.length - 1].end,
    now: nowMs,
  };
  const downtime = durationDowntimeMs(events, window, segments);
  const up = Math.max(0, totalMs - downtime);
  return { percentage: floorPct(up / totalMs), up, total: totalMs };
}

function eventOnlyMonth(
  events: Event[],
  key: string,
  nowMs: number,
  notBeforeMs?: number,
): MonthValue {
  const { start, end } = monthRange(`${key}-01`);
  // months fully before the component existed are "no data", not fake 100%
  if (notBeforeMs !== undefined && end <= notBeforeMs) return null;
  const clampedEnd = Math.min(end, nowMs);
  if (clampedEnd <= start) return null;
  const total = clampedEnd - start;
  const downtime = reportsOnlyDowntimeMs(events, {
    start,
    end: clampedEnd,
    now: nowMs,
  });
  const up = Math.max(0, total - downtime);
  return { percentage: floorPct(up / total), up, total };
}

/**
 * Read-time uptime history for a page: frozen monthly counts + live Tinybird
 * for months the freeze hasn't covered, percentages recomputed under the
 * page's current calculation mode.
 */
export async function getUptimeHistory(args: {
  ctx: ServiceContext;
  input: GetUptimeHistoryInput;
  pipes?: UptimeFreezePipes;
  now?: Date;
  sleep?: (ms: number) => Promise<void>;
}): Promise<UptimeHistoryResult> {
  const { ctx } = args;
  const input = GetUptimeHistoryInput.parse(args.input);
  if (!ctx.workspace.limits["uptime-history"]) {
    throw new ForbiddenError("Uptime history is not enabled on this plan.");
  }
  const db = getReadDb(ctx);
  const now = args.now ?? new Date();
  const nowMs = now.getTime();

  const _page = await db.query.page.findFirst({
    where: (page, { and: andWhere, eq: eqWhere }) =>
      andWhere(
        eqWhere(page.id, input.pageId),
        eqWhere(page.workspaceId, ctx.workspace.id),
      ),
    with: {
      statusReports: {
        with: {
          statusReportUpdates: {
            orderBy: (updates, { desc }) => desc(updates.date),
            with: { statusReportUpdateToPageComponents: true },
          },
          statusReportsToPageComponents: { with: { pageComponent: true } },
        },
      },
      maintenances: {
        with: {
          maintenancesToPageComponents: { with: { pageComponent: true } },
        },
      },
      pageComponents: {
        with: { monitor: { with: { incidents: true } } },
        orderBy: (components, { asc }) => asc(components.order),
      },
    },
  });
  if (!_page) throw new NotFoundError("page", input.pageId);

  const configuration = pageConfigurationSchema.safeParse(
    _page.configuration ?? {},
  );
  const mode = configuration.success ? configuration.data.value : "requests";

  const months = monthKeys(now);
  const currentKey = months[months.length - 1];
  const previousKey = months[months.length - 2];

  const components = _page.pageComponents;
  const monitorIds = [
    ...new Set(
      components.flatMap((c) => (c.monitorId !== null ? [c.monitorId] : [])),
    ),
  ];

  // the frozen-rows read and the independent Tinybird round-trip overlap
  const dbReads = (async () => {
    if (monitorIds.length === 0) return { frozenRows: [] };
    const frozenRows = await db
      .select({
        monitorId: frozenMonitorUptime.monitorId,
        month: frozenMonitorUptime.month,
        days: frozenMonitorUptime.days,
      })
      .from(frozenMonitorUptime)
      .where(
        and(
          eq(frozenMonitorUptime.workspaceId, ctx.workspace.id),
          inArray(frozenMonitorUptime.monitorId, monitorIds),
          gte(frozenMonitorUptime.month, `${months[0]}-01`),
        ),
      );
    return { frozenRows };
  })();

  // current month is never frozen, the previous may not be yet (freeze runs
  // on the 10th) — both come live from the 45d pipes; fetchFreezeCounts never
  // throws, failed monitors land in failedMonitorIds and render as no-data
  const liveReads = (async () => {
    if (monitorIds.length === 0) {
      return {
        counts: [] as ComputeCountRow[],
        failedMonitorIds: new Set<string>(),
      };
    }
    const monitorIdsByJobType = new Map<string, Set<string>>();
    for (const c of components) {
      if (c.monitorId === null || !c.monitor) continue;
      const ids = monitorIdsByJobType.get(c.monitor.jobType) ?? new Set();
      ids.add(String(c.monitorId));
      monitorIdsByJobType.set(c.monitor.jobType, ids);
    }
    const pipes = args.pipes ?? {
      http: defaultTb.httpStatus45d,
      tcp: defaultTb.tcpStatus45d,
      dns: defaultTb.dnsStatus45d,
    };
    return fetchFreezeCounts({
      monitorIdsByJobType,
      pipes,
      throttleMs: 0,
      sleep: args.sleep,
    });
  })();

  const [{ frozenRows }, { counts: liveCounts, failedMonitorIds: liveFailed }] =
    await Promise.all([dbReads, liveReads]);
  const frozenByKey = new Map(
    frozenRows.map((r) => [`${r.monitorId}:${r.month.slice(0, 7)}`, r.days]),
  );

  const liveByMonitorMonth = new Map<string, Map<string, DayCount>>();
  for (const row of liveCounts) {
    const day = row.day.slice(0, 10);
    const key = day.slice(0, 7);
    if (key !== currentKey && key !== previousKey) continue;
    const mapKey = `${row.monitorId}:${key}`;
    const byDay = liveByMonitorMonth.get(mapKey) ?? new Map<string, DayCount>();
    const acc = byDay.get(day) ?? { day, ok: 0, degraded: 0, error: 0 };
    acc.ok += row.ok;
    acc.degraded += row.degraded;
    acc.error += row.error;
    byDay.set(day, acc);
    liveByMonitorMonth.set(mapKey, byDay);
  }

  function countsFor(monitorId: number, key: string): DayCount[] | null {
    const frozen = frozenByKey.get(`${monitorId}:${key}`);
    if (frozen && key !== currentKey) return frozen;
    // older unfrozen months are never reconstructed from the partial 45d
    // overlap — backfill is the fix, not partial months
    const isLive = key === currentKey || key === previousKey;
    if (!isLive || liveFailed.has(String(monitorId))) return null;
    const byDay = liveByMonitorMonth.get(`${monitorId}:${key}`);
    if (!byDay || byDay.size === 0) return null;
    return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
  }

  const pastDays = HISTORY_MONTHS * 31 + 7;
  const rows: UptimeHistoryRow[] = components.map((c) => {
    const events = getEvents({
      maintenances: _page.maintenances,
      incidents: c.monitor?.incidents ?? [],
      reports: _page.statusReports,
      pageComponentId: c.id,
      monitorId: c.monitorId ?? undefined,
      componentType: c.type,
      pastDays,
    });

    const values = new Map<string, MonthValue>();
    for (const key of months) {
      let value: MonthValue = null;
      if (c.type === "monitor" && c.monitorId !== null) {
        const days = countsFor(c.monitorId, key);
        if (mode === "requests") {
          value = requestsMonth(days);
        } else if (mode === "duration") {
          value = durationMonth(days, events, nowMs);
        } else {
          // manual mode still keys "did the monitor run" off counts: a
          // zero-check month has no meaningful uptime in any mode
          value = days?.some((d) => d.ok + d.degraded + d.error > 0)
            ? eventOnlyMonth(events, key, nowMs)
            : null;
        }
      } else {
        value = eventOnlyMonth(
          events,
          key,
          nowMs,
          c.createdAt?.getTime() ?? undefined,
        );
      }
      values.set(key, value);
    }

    const rolling = {} as Record<HistoryWindowKey, number | null>;
    for (const w of WINDOWS) {
      let up = 0;
      let total = 0;
      for (const key of months.slice(-w)) {
        const v = values.get(key);
        if (!v) continue;
        up += v.up;
        total += v.total;
      }
      rolling[windowKey(w)] = total > 0 ? floorPct(up / total) : null;
    }

    return {
      component: {
        id: c.id,
        name: c.name,
        type: c.type === "static" ? ("static" as const) : ("monitor" as const),
        monitorId: c.monitorId,
      },
      months: Object.fromEntries(
        months.map((k) => [k, values.get(k)?.percentage ?? null]),
      ),
      rolling,
      events: events.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        status: e.status,
        from: e.from,
        to: e.to,
      })),
    };
  });

  // page-level events (no component filter) for the report metric
  const pageEvents = getEvents({
    maintenances: _page.maintenances,
    incidents: [],
    reports: _page.statusReports,
    pastDays,
  });

  const summary = {} as UptimeHistoryResult["summary"];
  for (const w of WINDOWS) {
    const windowStart = monthRange(`${months[months.length - w]}-01`).start;
    const seen = new Set<number>();
    for (const e of pageEvents) {
      if (e.type !== "report") continue;
      const endMs = e.to?.getTime() ?? nowMs;
      if (e.from.getTime() <= nowMs && endMs >= windowStart) {
        seen.add(e.id);
      }
    }
    // components weigh equally — native units (checks vs ms) differ per
    // component, so a cross-component sum would weight by unit volume
    const wk = windowKey(w);
    const uptimes = rows.flatMap((r) =>
      r.rolling[wk] !== null ? [r.rolling[wk] as number] : [],
    );
    summary[wk] = {
      uptime:
        uptimes.length > 0
          ? Math.floor(
              (uptimes.reduce((a, b) => a + b, 0) / uptimes.length) * 100,
            ) / 100
          : null,
      reports: seen.size,
    };
  }

  return {
    mode,
    months,
    createdAt: _page.createdAt,
    summary,
    rows,
  };
}
