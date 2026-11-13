import { and, asc, eq, gte, inArray, isNotNull, isNull } from "@openstatus/db";
import {
  frozenMonitorUptime,
  frozenMonitorUptimeDaySchema,
  monitor,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  monitorSlaSealedMonth,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import { sumMonthRuns } from "./evaluate";
import type { SlaEpisodesPipes } from "./fetch-episodes";
import {
  assertMonitorSlaLimit,
  episodeMonths,
  type FetchedEpisodes,
  fetchMonthEpisodes,
  loadTermsHistory,
  memberTimeMonth,
  policiesExcusedSpans,
  termsStateOf,
} from "./internal";
import {
  completeMonths,
  coveredSpan,
  LAST_TWELVE,
  type MonitorSlaMonth,
  monthCellKey,
  rollUpMonth,
  storedMonth,
} from "./months";
import { ListMonitorSlaPoliciesInput } from "./schemas";

/**
 * Policies with a twelve-month strip, judged as `getMonitorSlaPolicy` does. `target`/`strict`
 * are the latest terms set; `liveTerms` judge the running month, `pendingTerms` follow.
 */
export async function listMonitorSlaPolicies(args: {
  ctx: ServiceContext;
  input?: ListMonitorSlaPoliciesInput;
  now?: Date;
  episodesPipes?: SlaEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = ListMonitorSlaPoliciesInput.parse(args.input ?? {});
  assertMonitorSlaLimit(ctx);
  const db = getReadDb(ctx);

  const rows = await db
    .select()
    .from(monitorSlaPolicy)
    .where(
      and(
        eq(monitorSlaPolicy.workspaceId, ctx.workspace.id),
        input.archived
          ? isNotNull(monitorSlaPolicy.archivedAt)
          : isNull(monitorSlaPolicy.archivedAt),
      ),
    )
    .orderBy(asc(monitorSlaPolicy.id))
    .all();
  if (rows.length === 0) return [];
  const history = await loadTermsHistory(db, ctx.workspace.id, rows);
  const policies = rows.map((p) => {
    const latest = history.latest(p.id);
    return { ...p, target: latest.target, strict: latest.strict };
  });

  const links = await db
    .select({
      policyId: monitorSlaPolicyToMonitor.monitorSlaPolicyId,
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
        inArray(
          monitorSlaPolicyToMonitor.monitorSlaPolicyId,
          policies.map((p) => p.id),
        ),
        eq(monitor.workspaceId, ctx.workspace.id),
        isNull(monitor.deletedAt),
      ),
    )
    .orderBy(asc(monitor.id))
    .all();

  const now = args.now ?? new Date();
  const monthsOf = new Map(
    policies.map((p) => [p.id, completeMonths(now, LAST_TWELVE, p.timeZone)]),
  );
  const firstMonth = [...monthsOf.values()]
    .map((months) => months[0])
    .reduce((a, b) => (a < b ? a : b));
  const monitorIds = [...new Set(links.map((l) => l.id))];
  const frozenRows =
    monitorIds.length === 0
      ? []
      : await db
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
              gte(frozenMonitorUptime.month, firstMonth),
            ),
          )
          .all();
  const sealedRows =
    monitorIds.length === 0
      ? []
      : await db
          .select()
          .from(monitorSlaSealedMonth)
          .where(
            and(
              eq(monitorSlaSealedMonth.workspaceId, ctx.workspace.id),
              inArray(
                monitorSlaSealedMonth.monitorSlaPolicyId,
                policies.map((p) => p.id),
              ),
              gte(monitorSlaSealedMonth.month, firstMonth),
            ),
          )
          .all();
  // any seal, not only the strip's months: it decides delete vs archive
  const everSealed = new Set(
    (
      await db
        .selectDistinct({ id: monitorSlaSealedMonth.monitorSlaPolicyId })
        .from(monitorSlaSealedMonth)
        .where(
          and(
            eq(monitorSlaSealedMonth.workspaceId, ctx.workspace.id),
            inArray(
              monitorSlaSealedMonth.monitorSlaPolicyId,
              policies.map((p) => p.id),
            ),
          ),
        )
        .all()
    ).map((r) => r.id),
  );
  const frozen = new Map(
    frozenRows.map((r) => [
      monthCellKey(r.monitorId, r.month),
      sumMonthRuns(frozenMonitorUptimeDaySchema.array().parse(r.days)),
    ]),
  );
  const sealed = new Map(
    sealedRows.map((r) => [
      `${r.monitorSlaPolicyId}:${monthCellKey(r.monitorId, r.month)}`,
      r,
    ]),
  );

  function membersOf(policyId: number) {
    return links.filter((l) => l.policyId === policyId);
  }

  // the previous month on episodes, for the members it is not sealed for yet
  const previews = new Map<number, { month: string; members: typeof links }>();
  for (const policy of policies) {
    const [month] = [...episodeMonths(now, policy.timeZone)].flatMap(
      ([m, state]) => (state === "preview" ? [m] : []),
    );
    if (!month) continue;
    const members = membersOf(policy.id).filter(
      (m) => !sealed.has(`${policy.id}:${monthCellKey(m.id, month)}`),
    );
    if (members.length > 0) previews.set(policy.id, { month, members });
  }
  const fetchedByZone = new Map<string, FetchedEpisodes>();
  for (const timeZone of new Set(
    policies.filter((p) => previews.has(p.id)).map((p) => p.timeZone),
  )) {
    const inZone = policies.filter(
      (p) => p.timeZone === timeZone && previews.has(p.id),
    );
    const month = previews.get(inZone[0].id)?.month;
    if (!month) continue;
    // a member without covered time reads as none: no need to fetch it
    const members = [
      ...new Map(
        inZone
          .flatMap((p) => previews.get(p.id)?.members ?? [])
          .filter((m) => coveredSpan(month, timeZone, m.memberSince, now))
          .map((m) => [m.id, m]),
      ).values(),
    ];
    fetchedByZone.set(
      timeZone,
      await fetchMonthEpisodes({
        ctx,
        members,
        months: [month],
        timeZone,
        now,
        pipes: args.episodesPipes,
        sleep: args.sleep,
      }),
    );
  }
  const previewCells = new Map<string, MonitorSlaMonth>();
  const spansOf = await policiesExcusedSpans(db, ctx.workspace.id, [
    ...previews.keys(),
  ]);
  for (const policy of policies) {
    const preview = previews.get(policy.id);
    const fetched = fetchedByZone.get(policy.timeZone);
    if (!preview || !fetched) continue;
    const terms = history.at(policy.id, preview.month);
    const excusedSpans = spansOf.get(policy.id) ?? [];
    for (const m of preview.members) {
      previewCells.set(
        `${policy.id}:${monthCellKey(m.id, preview.month)}`,
        memberTimeMonth({
          month: preview.month,
          state: "preview",
          member: m,
          fetched,
          excusedSpans,
          terms,
          timeZone: policy.timeZone,
          now,
        }),
      );
    }
  }

  return policies.map((policy) => {
    const members = membersOf(policy.id).map(
      ({
        policyId: _,
        regions: _regions,
        periodicity: _periodicity,
        memberSince: _memberSince,
        ...m
      }) => m,
    );
    // the current month is live and stays off the list
    const strip = (monthsOf.get(policy.id) ?? []).map((month) =>
      rollUpMonth(
        month,
        members.map((m) => {
          const key = `${policy.id}:${monthCellKey(m.id, month)}`;
          return (
            previewCells.get(key) ??
            storedMonth({
              month,
              seal: sealed.get(key),
              frozen: frozen.get(monthCellKey(m.id, month)),
              policy,
            })
          );
        }),
      ),
    );
    const missed = strip.filter((m) => m.status === "missed");
    return {
      ...policy,
      ...termsStateOf(history, policy, now),
      monitors: members,
      sealed: everSealed.has(policy.id),
      months: strip,
      missed: {
        months: missed.length,
        previews: missed.filter((m) => m.preview).length,
        of: LAST_TWELVE,
      },
    };
  });
}

export type MonitorSlaPolicyListItem = Awaited<
  ReturnType<typeof listMonitorSlaPolicies>
>[number];
