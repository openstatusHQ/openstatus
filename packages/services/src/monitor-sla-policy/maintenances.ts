import { and, asc, eq, gt, inArray, isNull, lte } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  monitorSlaPolicyToMonitor,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import { monthRange } from "../frozen-uptime/compute";
import { excusedWindowLock } from "./excused";
import { assertMonitorSlaLimit, findPolicy, sealedMonthsOf } from "./internal";
import { completeMonths, monthOf } from "./months";
import { GetMonitorSlaPolicyInput } from "./schemas";

/**
 * The status page maintenances that touched a policy's monitors in the same
 * months as `getMonitorSlaPolicy`, and whether each monitor pauses checks during one. Windows that have not started yet are left out.
 */
export async function listMonitorSlaPolicyMaintenances(args: {
  ctx: ServiceContext;
  input: GetMonitorSlaPolicyInput;
  now?: Date;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetMonitorSlaPolicyInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const db = getReadDb(ctx);

  const policy = await findPolicy(db, ctx, input.id);

  const now = args.now ?? new Date();
  const { timeZone } = policy;
  const months = [
    ...completeMonths(now, input.months, timeZone),
    monthOf(now, timeZone),
  ];
  const rangeStart = new Date(monthRange(months[0], timeZone).start);

  const members = await db
    .select({
      id: monitor.id,
      name: monitor.name,
      maintenanceMode: monitor.maintenanceMode,
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
  if (members.length === 0) return { months, monitors: [], windows: [] };
  const memberIds = members.map((m) => m.id);

  const components = await db
    .select({
      monitorId: pageComponent.monitorId,
      pageId: page.id,
      pageTitle: page.title,
    })
    .from(pageComponent)
    .innerJoin(page, eq(page.id, pageComponent.pageId))
    .where(
      and(
        eq(pageComponent.workspaceId, ctx.workspace.id),
        inArray(pageComponent.monitorId, memberIds),
      ),
    )
    .orderBy(asc(page.id))
    .all();

  const touched = await db
    .select({
      id: maintenance.id,
      title: maintenance.title,
      from: maintenance.from,
      to: maintenance.to,
      pageId: maintenance.pageId,
      pageTitle: page.title,
      monitorId: pageComponent.monitorId,
    })
    .from(maintenancesToPageComponents)
    .innerJoin(
      maintenance,
      eq(maintenance.id, maintenancesToPageComponents.maintenanceId),
    )
    .innerJoin(
      pageComponent,
      eq(pageComponent.id, maintenancesToPageComponents.pageComponentId),
    )
    .leftJoin(page, eq(page.id, maintenance.pageId))
    .where(
      and(
        eq(maintenance.workspaceId, ctx.workspace.id),
        inArray(pageComponent.monitorId, memberIds),
        lte(maintenance.from, now),
        gt(maintenance.to, rangeStart),
      ),
    )
    .all();

  type Window = {
    id: number;
    title: string;
    from: Date;
    to: Date;
    pageId: number | null;
    pageTitle: string | null;
    monitorIds: number[];
    /** Listed once, under the month it started in, or the first month shown. */
    month: string;
    /** Every month it touches can still take an excused window. */
    excusable: boolean;
  };
  const sealed = await sealedMonthsOf(db, policy);
  const windows = new Map<number, Window>();
  for (const row of touched) {
    if (row.monitorId === null) continue;
    const { monitorId, ...rest } = row;
    const window = windows.get(row.id) ?? {
      ...rest,
      monitorIds: [],
      month: row.from < rangeStart ? months[0] : monthOf(row.from, timeZone),
      excusable:
        policy.archivedAt === null &&
        excusedWindowLock(row, { now, sealed, timeZone }) === null,
    };
    if (!window.monitorIds.includes(monitorId)) {
      window.monitorIds.push(monitorId);
    }
    windows.set(row.id, window);
  }

  return {
    months,
    monitors: members.map((m) => ({
      ...m,
      statusPages: components
        .filter((c) => c.monitorId === m.id)
        .map((c) => ({ id: c.pageId, title: c.pageTitle })),
    })),
    windows: [...windows.values()]
      .map((w) => ({ ...w, monitorIds: w.monitorIds.sort((a, b) => a - b) }))
      .sort((a, b) => b.from.getTime() - a.from.getTime() || b.id - a.id),
  };
}

export type MonitorSlaPolicyMaintenances = Awaited<
  ReturnType<typeof listMonitorSlaPolicyMaintenances>
>;
