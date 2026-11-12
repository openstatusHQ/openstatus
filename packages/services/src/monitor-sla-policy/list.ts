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
import { assertMonitorSlaLimit } from "./internal";
import {
  completeMonths,
  LAST_TWELVE,
  monthCellKey,
  rollUpMonth,
  storedMonth,
} from "./months";
import { ListMonitorSlaPoliciesInput } from "./schemas";

/**
 * Policies with a twelve-month strip from sealed and frozen months; never asks
 * Tinybird. Unsealed months ignore excused windows: they are previews, and the
 * policy page applies the windows.
 */
export async function listMonitorSlaPolicies(args: {
  ctx: ServiceContext;
  input?: ListMonitorSlaPoliciesInput;
  now?: Date;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = ListMonitorSlaPoliciesInput.parse(args.input ?? {});
  assertMonitorSlaLimit(ctx);
  const db = getReadDb(ctx);

  const policies = await db
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
  if (policies.length === 0) return [];

  const links = await db
    .select({
      policyId: monitorSlaPolicyToMonitor.monitorSlaPolicyId,
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      jobType: monitor.jobType,
      regions: monitor.regions,
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
  const months = completeMonths(now, LAST_TWELVE);
  const firstMonth = months[0];
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

  return policies.map((policy) => {
    const members = membersOf(policy.id).map(
      ({ policyId: _, regions: _regions, ...m }) => m,
    );
    // the current month is live (Tinybird) and stays off the list; so does an
    // unfrozen previous month, which reads as none here
    const strip = months.map((month) =>
      rollUpMonth(
        month,
        members.map((m) => {
          const key = monthCellKey(m.id, month);
          return storedMonth({
            month,
            seal: sealed.get(`${policy.id}:${key}`),
            frozen: frozen.get(key),
            policy,
          });
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

export type MonitorSlaPolicyListItem = Awaited<
  ReturnType<typeof listMonitorSlaPolicies>
>[number];
