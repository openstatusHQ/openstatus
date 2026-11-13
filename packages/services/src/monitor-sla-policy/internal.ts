import { and, asc, desc, eq, gte, inArray, isNull, lte } from "@openstatus/db";
import {
  frozenMonitorUptime,
  frozenMonitorUptimeDaySchema,
  monitor,
  monitorSlaExcusedWindow,
  monitorSlaPolicy,
  monitorSlaPolicyTerms,
  monitorSlaPolicyToMonitor,
  monitorSlaSealedMonth,
} from "@openstatus/db/src/schema";
import {
  monitorSlaIneligibleReason,
  monitorSlaJobTypes,
} from "@openstatus/db/src/schema/monitor_sla_policies/constants";

import { type DB, defaultTb, getReadDb, type ServiceContext } from "../context";
import {
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
  ValidationError,
} from "../errors";
import { monthRange } from "../frozen-uptime/compute";
import {
  type UptimeRunsPipes,
  type UptimeRunsRangePipes,
  uptimeRunsRangePipes,
} from "../frozen-uptime/run";
import type { Episode } from "./episodes";
import { sumMonthRuns } from "./evaluate";
import {
  excusedWindowLock,
  fetchExcusedCounts,
  mergeSpans,
  type Span,
} from "./excused";
import {
  clipEpisodes,
  type EpisodeMonitor,
  fetchSlaEpisodes,
  type SlaEpisodesPipes,
  slaEpisodesPipes,
} from "./fetch-episodes";
import {
  type CellExcused,
  completeMonths,
  coveredSpan,
  emptyMonth,
  liveUntilFrozen,
  type MonitorSlaMonth,
  monthCellKey,
  monthOf,
  storedMonth,
  timeMonth,
} from "./months";

// fails tsc when the run-verdict pipes and the eligible types drift apart
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _sameJobTypes: Exact<
  (typeof monitorSlaJobTypes)[number],
  keyof UptimeRunsPipes
> = true;

export function assertMonitorSlaLimit(ctx: ServiceContext): void {
  if (!ctx.workspace.limits["monitor-sla"]) {
    throw new ForbiddenError("SLA policies are not enabled on this plan.");
  }
}

/** Dedupe, check workspace ownership and eligibility; returns ids in input order. */
export async function validatePolicyMonitorIds(args: {
  tx: DB;
  workspaceId: number;
  monitorIds: ReadonlyArray<number>;
}): Promise<number[]> {
  const ids = Array.from(new Set(args.monitorIds));
  if (ids.length === 0) return [];
  const rows = await args.tx
    .select({
      id: monitor.id,
      name: monitor.name,
      jobType: monitor.jobType,
      regions: monitor.regions,
    })
    .from(monitor)
    .where(
      and(
        inArray(monitor.id, ids),
        eq(monitor.workspaceId, args.workspaceId),
        isNull(monitor.deletedAt),
      ),
    )
    .all();
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) throw new NotFoundError("monitor", id);
    const reason = monitorSlaIneligibleReason(row);
    if (reason) {
      throw new ValidationError(
        `Monitor "${row.name}" cannot be under an SLA policy: ${reason}.`,
      );
    }
  }
  return ids;
}

/** The policy in the caller's workspace, archived or not. */
export async function findPolicy(db: DB, ctx: ServiceContext, id: number) {
  const row = await db
    .select()
    .from(monitorSlaPolicy)
    .where(
      and(
        eq(monitorSlaPolicy.id, id),
        eq(monitorSlaPolicy.workspaceId, ctx.workspace.id),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("monitor_sla_policy", id);
  return row;
}

/** The policy for a write; an archived policy is read-only. */
export async function getWritablePolicy(
  tx: DB,
  ctx: ServiceContext,
  id: number,
) {
  const row = await findPolicy(tx, ctx, id);
  if (row.archivedAt) {
    throw new PreconditionFailedError(
      "This SLA policy is archived and can no longer be edited.",
    );
  }
  return row;
}

export type MonitorSlaTerms = {
  target: number;
  strict: boolean;
  /** YYYY-MM-01 of the terms row; null when the policy row's own terms apply */
  effectiveFrom: string | null;
};

type PolicyTermsRef = {
  id: number;
  workspaceId: number;
  target: number;
  strict: boolean;
};

/**
 * Terms that judge `month` (YYYY-MM-01): the latest terms row in effect by then,
 * else the policy row's as stored (callers may hold the latest terms instead).
 */
export async function termsForMonth(
  db: DB,
  policy: { id: number; workspaceId: number },
  month: string,
): Promise<MonitorSlaTerms> {
  const row = await db
    .select({
      target: monitorSlaPolicyTerms.target,
      strict: monitorSlaPolicyTerms.strict,
      effectiveFrom: monitorSlaPolicyTerms.effectiveFrom,
    })
    .from(monitorSlaPolicyTerms)
    .where(
      and(
        eq(monitorSlaPolicyTerms.monitorSlaPolicyId, policy.id),
        eq(monitorSlaPolicyTerms.workspaceId, policy.workspaceId),
        lte(monitorSlaPolicyTerms.effectiveFrom, month),
      ),
    )
    .orderBy(desc(monitorSlaPolicyTerms.effectiveFrom))
    .limit(1)
    .get();
  if (row) return row;
  const own = await db
    .select({
      target: monitorSlaPolicy.target,
      strict: monitorSlaPolicy.strict,
    })
    .from(monitorSlaPolicy)
    .where(
      and(
        eq(monitorSlaPolicy.id, policy.id),
        eq(monitorSlaPolicy.workspaceId, policy.workspaceId),
      ),
    )
    .get();
  if (!own) throw new NotFoundError("monitor_sla_policy", policy.id);
  return { ...own, effectiveFrom: null };
}

export type MonitorSlaTermsState = {
  /** YYYY-MM-01 of the running month in the policy zone */
  liveMonth: string;
  /** the terms judging the running month */
  liveTerms: { target: number; strict: boolean };
  /** terms set to apply from a later month; null when none are */
  pendingTerms: {
    target: number;
    strict: boolean;
    effectiveFrom: string;
  } | null;
};

type DatedTerms = MonitorSlaTerms & { effectiveFrom: string };

/** Every terms row of `policies`, one query; the policy row's own terms apply before the first. */
export async function loadTermsHistory(
  db: DB,
  workspaceId: number,
  policies: ReadonlyArray<PolicyTermsRef>,
) {
  const rows =
    policies.length === 0
      ? []
      : await db
          .select({
            policyId: monitorSlaPolicyTerms.monitorSlaPolicyId,
            target: monitorSlaPolicyTerms.target,
            strict: monitorSlaPolicyTerms.strict,
            effectiveFrom: monitorSlaPolicyTerms.effectiveFrom,
          })
          .from(monitorSlaPolicyTerms)
          .where(
            and(
              eq(monitorSlaPolicyTerms.workspaceId, workspaceId),
              inArray(
                monitorSlaPolicyTerms.monitorSlaPolicyId,
                policies.map((p) => p.id),
              ),
            ),
          )
          .orderBy(asc(monitorSlaPolicyTerms.effectiveFrom))
          .all();
  const own = new Map(policies.map((p) => [p.id, p]));
  const byPolicy = new Map<number, DatedTerms[]>();
  for (const { policyId, ...terms } of rows) {
    const list = byPolicy.get(policyId) ?? [];
    list.push(terms);
    byPolicy.set(policyId, list);
  }
  const base = (policyId: number): MonitorSlaTerms => {
    const p = own.get(policyId);
    if (!p) throw new NotFoundError("monitor_sla_policy", policyId);
    return { target: p.target, strict: p.strict, effectiveFrom: null };
  };
  const rowsOf = (policyId: number) => byPolicy.get(policyId) ?? [];
  return {
    /** the terms judging `month`, as termsForMonth */
    at(policyId: number, month: string): MonitorSlaTerms {
      return (
        rowsOf(policyId).findLast((t) => t.effectiveFrom <= month) ??
        base(policyId)
      );
    },
    /** the last terms set to start after `month` */
    after(policyId: number, month: string): DatedTerms | null {
      return rowsOf(policyId).findLast((t) => t.effectiveFrom > month) ?? null;
    },
    latest(policyId: number): MonitorSlaTerms {
      return rowsOf(policyId).at(-1) ?? base(policyId);
    },
  };
}

export type TermsHistory = Awaited<ReturnType<typeof loadTermsHistory>>;

/** The running month's terms and any pending ones, from a loaded history. */
export function termsStateOf(
  history: TermsHistory,
  policy: { id: number; timeZone: string },
  now: Date,
): MonitorSlaTermsState {
  const liveMonth = monthOf(now, policy.timeZone);
  const live = history.at(policy.id, liveMonth);
  const pending = history.after(policy.id, liveMonth);
  return {
    liveMonth,
    liveTerms: { target: live.target, strict: live.strict },
    pendingTerms: pending
      ? {
          target: pending.target,
          strict: pending.strict,
          effectiveFrom: pending.effectiveFrom,
        }
      : null,
  };
}

/** The most recently set terms per policy, pending ones included; previews follow these. */
export async function latestTermsOf(
  db: DB,
  workspaceId: number,
  policies: ReadonlyArray<PolicyTermsRef>,
): Promise<Map<number, MonitorSlaTerms>> {
  const history = await loadTermsHistory(db, workspaceId, policies);
  return new Map(policies.map((p) => [p.id, history.latest(p.id)]));
}

/** Policies as callers see them: `target`/`strict` are the latest terms set. */
export async function withLatestTerms<T extends PolicyTermsRef>(
  db: DB,
  workspaceId: number,
  policies: ReadonlyArray<T>,
): Promise<T[]> {
  const latest = await latestTermsOf(db, workspaceId, policies);
  return policies.map((p) => {
    const terms = latest.get(p.id);
    return terms ? { ...p, target: terms.target, strict: terms.strict } : p;
  });
}

/** Every month the policy sealed for any monitor. */
export async function sealedMonthsOf(
  tx: DB,
  policy: { id: number; workspaceId: number },
) {
  return tx
    .selectDistinct({ month: monitorSlaSealedMonth.month })
    .from(monitorSlaSealedMonth)
    .where(
      and(
        eq(monitorSlaSealedMonth.monitorSlaPolicyId, policy.id),
        eq(monitorSlaSealedMonth.workspaceId, policy.workspaceId),
      ),
    )
    .all();
}

export async function assertExcusedWindowOpen(
  tx: DB,
  policy: { id: number; workspaceId: number; timeZone?: string },
  window: { from: Date; to: Date },
  now: Date,
): Promise<void> {
  const lock = excusedWindowLock(window, {
    now,
    sealed: await sealedMonthsOf(tx, policy),
    timeZone: policy.timeZone,
  });
  if (lock === "sealed") {
    throw new PreconditionFailedError(
      "This window touches a sealed month. A sealed month keeps the windows it was sealed with.",
    );
  }
  if (lock === "closed") {
    throw new PreconditionFailedError(
      "Windows can only be added or removed in the current and the previous month.",
    );
  }
}

/** The policy (latest terms) and its current members (non-deleted monitors), by monitor id. */
export async function loadPolicyMembers(ctx: ServiceContext, id: number) {
  const db = getReadDb(ctx);
  const row = await findPolicy(db, ctx, id);
  const history = await loadTermsHistory(db, ctx.workspace.id, [row]);
  const latest = history.latest(row.id);
  const policy = { ...row, target: latest.target, strict: latest.strict };
  const monitors = await db
    .select({
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      jobType: monitor.jobType,
      regions: monitor.regions,
      periodicity: monitor.periodicity,
      memberSince: monitorSlaPolicyToMonitor.createdAt,
    })
    .from(monitorSlaPolicyToMonitor)
    .innerJoin(monitor, eq(monitor.id, monitorSlaPolicyToMonitor.monitorId))
    .where(
      and(
        eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, policy.id),
        eq(monitor.workspaceId, ctx.workspace.id),
        isNull(monitor.deletedAt),
      ),
    )
    .orderBy(asc(monitor.id))
    .all();
  return { policy, monitors, history };
}

export type PolicyMember = Awaited<
  ReturnType<typeof loadPolicyMembers>
>["monitors"][number];

/** The running month (live) and the previous one while its runs are kept (preview): the months judged on episodes. */
export function episodeMonths(
  now: Date,
  timeZone: string,
): Map<string, "live" | "preview"> {
  const months = new Map<string, "live" | "preview">([
    [monthOf(now, timeZone), "live"],
  ]);
  const [previous] = completeMonths(now, 1, timeZone);
  if (liveUntilFrozen(previous, now, timeZone)) months.set(previous, "preview");
  return months;
}

/** Excused windows per policy, merged, one query. */
export async function policiesExcusedSpans(
  db: DB,
  workspaceId: number,
  policyIds: readonly number[],
): Promise<Map<number, Span[]>> {
  const rows =
    policyIds.length === 0
      ? []
      : await db
          .select({
            policyId: monitorSlaExcusedWindow.monitorSlaPolicyId,
            from: monitorSlaExcusedWindow.from,
            to: monitorSlaExcusedWindow.to,
          })
          .from(monitorSlaExcusedWindow)
          .where(
            and(
              eq(monitorSlaExcusedWindow.workspaceId, workspaceId),
              inArray(monitorSlaExcusedWindow.monitorSlaPolicyId, [
                ...policyIds,
              ]),
            ),
          )
          .all();
  return new Map(
    policyIds.map((id) => [
      id,
      mergeSpans(rows.filter((r) => r.policyId === id)),
    ]),
  );
}

/** Excused windows of the policy, merged. */
export async function policyExcusedSpans(
  db: DB,
  policy: { id: number; workspaceId: number },
): Promise<Span[]> {
  return mergeSpans(
    await db
      .select({
        from: monitorSlaExcusedWindow.from,
        to: monitorSlaExcusedWindow.to,
      })
      .from(monitorSlaExcusedWindow)
      .where(
        and(
          eq(monitorSlaExcusedWindow.monitorSlaPolicyId, policy.id),
          eq(monitorSlaExcusedWindow.workspaceId, policy.workspaceId),
        ),
      )
      .all(),
  );
}

/**
 * The range episodes for `months` are read over: the first month's start to
 * now, so a month's last runs are weighed against the runs that followed.
 * Page, list, export and seal all read it, so a preview equals its seal.
 */
export function episodeRange(
  months: readonly string[],
  timeZone: string,
  now: Date,
): Span {
  return {
    start: Math.min(...months.map((m) => monthRange(m, timeZone).start)),
    end: now.getTime(),
  };
}

export type FetchedEpisodes = Awaited<ReturnType<typeof fetchMonthEpisodes>>;

/**
 * Episodes of `members` for `months` (all in `timeZone`), one Tinybird read
 * over `episodeRange`. Never throws.
 */
export async function fetchMonthEpisodes(args: {
  ctx: ServiceContext;
  members: readonly EpisodeMonitor[];
  months: readonly string[];
  timeZone: string;
  now: Date;
  pipes?: SlaEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{
  episodes: Map<number, Episode[]>;
  failed: Set<number>;
  range: Span;
}> {
  if (args.months.length === 0 || args.members.length === 0) {
    return {
      episodes: new Map(),
      failed: new Set(),
      range: { start: 0, end: 0 },
    };
  }
  const range = episodeRange(args.months, args.timeZone, args.now);
  const res = await fetchSlaEpisodes({
    monitors: args.members,
    fromMs: range.start,
    toMs: range.end,
    pipes: () => args.pipes ?? slaEpisodesPipes(args.ctx.tb ?? defaultTb),
    throttleMs: 0,
    sleep: args.sleep,
  });
  return { ...res, range };
}

/** A member's fetched episodes; one not read (no run verdicts) has the range unmeasured. */
export function memberEpisodes(
  memberId: number,
  fetched: Awaited<ReturnType<typeof fetchMonthEpisodes>>,
): Episode[] {
  return (
    fetched.episodes.get(memberId) ?? [
      {
        kind: "unmeasured",
        startedAt: fetched.range.start,
        endedAt: fetched.range.end,
        runs: 0,
        weightedMs: fetched.range.end - fetched.range.start,
      },
    ]
  );
}

/** A member's month from its fetched episodes; the caller handles seals. */
export function memberTimeMonth(args: {
  month: string;
  state: "live" | "preview";
  member: Pick<PolicyMember, "id" | "memberSince">;
  fetched: Awaited<ReturnType<typeof fetchMonthEpisodes>>;
  excusedSpans: readonly Span[];
  terms: { target: number; strict: boolean };
  timeZone: string;
  now: Date;
}): MonitorSlaMonth {
  const { month, state, member, fetched, timeZone } = args;
  if (fetched.failed.has(member.id)) {
    return emptyMonth({ month, state, timeZone, method: "time" });
  }
  const covered = coveredSpan(month, timeZone, member.memberSince, args.now);
  if (!covered) return emptyMonth({ month, state: "none", timeZone });
  return timeMonth({
    month,
    state,
    episodes: clipEpisodes(
      memberEpisodes(member.id, fetched),
      covered.start,
      covered.end,
    ),
    covered,
    excusedSpans: args.excusedSpans,
    terms: args.terms,
    timeZone,
  });
}

/**
 * Each member's state per month (YYYY-MM-01 in the policy zone, ascending).
 * The running and previous month are judged on episodes under the terms they
 * started with; older unsealed months are run-count previews under the latest
 * terms (UTC only). Without `live`, the running month is not read.
 */
export async function judgePolicyMonths(args: {
  ctx: ServiceContext;
  policy: {
    id: number;
    workspaceId: number;
    target: number;
    strict: boolean;
    timeZone: string;
  };
  monitors: PolicyMember[];
  months: string[];
  now: Date;
  live: boolean;
  episodesPipes?: SlaEpisodesPipes;
  runsRangePipes?: UptimeRunsRangePipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx, policy, monitors, months, now } = args;
  const { timeZone } = policy;
  const db = getReadDb(ctx);
  const first = months[0];
  const last = months.at(-1);
  if (monitors.length === 0 || !first || !last) {
    return { monitors: [], liveIncomplete: false, excusedExpired: false };
  }
  const timeMonths = episodeMonths(now, timeZone);

  const frozenRows =
    timeZone === "UTC"
      ? await db
          .select({
            monitorId: frozenMonitorUptime.monitorId,
            month: frozenMonitorUptime.month,
            days: frozenMonitorUptime.days,
          })
          .from(frozenMonitorUptime)
          .where(
            and(
              eq(frozenMonitorUptime.workspaceId, ctx.workspace.id),
              inArray(
                frozenMonitorUptime.monitorId,
                monitors.map((m) => m.id),
              ),
              gte(frozenMonitorUptime.month, first),
              lte(frozenMonitorUptime.month, last),
            ),
          )
          .all()
      : [];
  const sealedRows = await db
    .select()
    .from(monitorSlaSealedMonth)
    .where(
      and(
        eq(monitorSlaSealedMonth.monitorSlaPolicyId, policy.id),
        eq(monitorSlaSealedMonth.workspaceId, ctx.workspace.id),
        gte(monitorSlaSealedMonth.month, first),
        lte(monitorSlaSealedMonth.month, last),
      ),
    )
    .all();
  const sealed = new Map(
    sealedRows.map((r) => [monthCellKey(r.monitorId, r.month), r]),
  );
  const frozen = new Map(
    frozenRows.map((r) => [
      monthCellKey(r.monitorId, r.month),
      sumMonthRuns(frozenMonitorUptimeDaySchema.array().parse(r.days)),
    ]),
  );
  const unsealedIn = (month: string) =>
    monitors.some((m) => !sealed.has(monthCellKey(m.id, month)));

  const spans = await policyExcusedSpans(db, policy);
  const readMonths = months.filter(
    (month) =>
      timeMonths.has(month) &&
      (args.live || timeMonths.get(month) !== "live") &&
      unsealedIn(month),
  );
  const fetched = await fetchMonthEpisodes({
    ctx,
    members: monitors,
    months: readMonths,
    timeZone,
    now,
    pipes: args.episodesPipes,
    sleep: args.sleep,
  });
  const termsOf = new Map(
    await Promise.all(
      readMonths.map(
        async (month) =>
          [month, await termsForMonth(db, policy, month)] as const,
      ),
    ),
  );

  const excused = await fetchExcusedCounts({
    monitors,
    spans,
    months:
      timeZone === "UTC"
        ? months.filter((month) => !timeMonths.has(month) && unsealedIn(month))
        : [],
    now,
    pipes: () =>
      args.runsRangePipes ?? uptimeRunsRangePipes(ctx.tb ?? defaultTb),
    sleep: args.sleep,
  });
  const excusedFor = (key: string): CellExcused =>
    excused.failed.has(key)
      ? "unavailable"
      : excused.expired.has(key)
        ? "expired"
        : excused.counts.get(key);

  const rows = monitors.map(
    ({ regions: _r, periodicity: _p, memberSince, ...m }) => ({
      ...m,
      months: months.map((month): MonitorSlaMonth => {
        const key = monthCellKey(m.id, month);
        const seal = sealed.get(key);
        if (seal) {
          return storedMonth({ month, seal, frozen: undefined, policy });
        }
        const state = timeMonths.get(month);
        const terms = termsOf.get(month);
        if (state && !terms) return emptyMonth({ month, state, timeZone });
        if (state && terms) {
          return memberTimeMonth({
            month,
            state,
            member: { id: m.id, memberSince },
            fetched,
            excusedSpans: spans,
            terms,
            timeZone,
            now,
          });
        }
        return storedMonth({
          month,
          seal: undefined,
          frozen: frozen.get(key),
          excused: excusedFor(key),
          policy,
        });
      }),
    }),
  );
  return {
    monitors: rows,
    liveIncomplete: fetched.failed.size > 0 || excused.failed.size > 0,
    /** some month's excused runs are older than Tinybird keeps: those cells are judged without their windows */
    excusedExpired: excused.expired.size > 0,
  };
}
