import { and, asc, eq, gte, inArray, isNotNull, isNull } from "@openstatus/db";
import {
  monitor,
  uptimeTarget,
  uptimeTargetToMonitor,
  uptimeTargetSealedMonth,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import type { UptimeEpisodesPipes } from "./fetch-episodes";
import {
  assertUptimeTargetLimit,
  episodeMonths,
  type FetchedEpisodes,
  fetchMonthEpisodes,
  memberTimeMonth,
  policiesExcusedSpans,
} from "./internal";
import {
  completeMonths,
  coveredSpan,
  LAST_TWELVE,
  type UptimeTargetMonth,
  monthCellKey,
  rollUpMonth,
  storedMonth,
} from "./months";
import { ListUptimeTargetsInput } from "./schemas";

/** Policies with a twelve-month strip, judged as `getUptimeTarget` does. */
export async function listUptimeTargets(args: {
  ctx: ServiceContext;
  input?: ListUptimeTargetsInput;
  now?: Date;
  episodesPipes?: UptimeEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = ListUptimeTargetsInput.parse(args.input ?? {});
  assertUptimeTargetLimit(ctx);
  const db = getReadDb(ctx);

  const policies = await db
    .select()
    .from(uptimeTarget)
    .where(
      and(
        eq(uptimeTarget.workspaceId, ctx.workspace.id),
        input.archived
          ? isNotNull(uptimeTarget.archivedAt)
          : isNull(uptimeTarget.archivedAt),
      ),
    )
    .orderBy(asc(uptimeTarget.id))
    .all();
  if (policies.length === 0) return [];

  const links = await db
    .select({
      policyId: uptimeTargetToMonitor.uptimeTargetId,
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      jobType: monitor.jobType,
      regions: monitor.regions,
      periodicity: monitor.periodicity,
      memberSince: uptimeTargetToMonitor.createdAt,
    })
    .from(uptimeTargetToMonitor)
    .innerJoin(monitor, eq(monitor.id, uptimeTargetToMonitor.monitorId))
    .where(
      and(
        inArray(
          uptimeTargetToMonitor.uptimeTargetId,
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
  const sealedRows =
    monitorIds.length === 0
      ? []
      : await db
          .select()
          .from(uptimeTargetSealedMonth)
          .where(
            and(
              eq(uptimeTargetSealedMonth.workspaceId, ctx.workspace.id),
              inArray(
                uptimeTargetSealedMonth.uptimeTargetId,
                policies.map((p) => p.id),
              ),
              gte(uptimeTargetSealedMonth.month, firstMonth),
            ),
          )
          .all();
  // any seal, not only the strip's months: it decides delete vs archive
  const everSealed = new Set(
    (
      await db
        .selectDistinct({ id: uptimeTargetSealedMonth.uptimeTargetId })
        .from(uptimeTargetSealedMonth)
        .where(
          and(
            eq(uptimeTargetSealedMonth.workspaceId, ctx.workspace.id),
            inArray(
              uptimeTargetSealedMonth.uptimeTargetId,
              policies.map((p) => p.id),
            ),
          ),
        )
        .all()
    ).map((r) => r.id),
  );
  const sealed = new Map(
    sealedRows.map((r) => [
      `${r.uptimeTargetId}:${monthCellKey(r.monitorId, r.month)}`,
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
  const previewCells = new Map<string, UptimeTargetMonth>();
  const spansOf = await policiesExcusedSpans(db, ctx.workspace.id, [
    ...previews.keys(),
  ]);
  for (const policy of policies) {
    const preview = previews.get(policy.id);
    const fetched = fetchedByZone.get(policy.timeZone);
    if (!preview || !fetched) continue;
    const spans = spansOf.get(policy.id);
    for (const m of preview.members) {
      previewCells.set(
        `${policy.id}:${monthCellKey(m.id, preview.month)}`,
        memberTimeMonth({
          month: preview.month,
          state: "preview",
          member: m,
          fetched,
          excusedSpans: spans?.get(m.id) ?? [],
          terms: policy,
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
              timeZone: policy.timeZone,
            })
          );
        }),
      ),
    );
    const missed = strip.filter((m) => m.status === "missed");
    return {
      ...policy,
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

export type UptimeTargetListItem = Awaited<
  ReturnType<typeof listUptimeTargets>
>[number];
