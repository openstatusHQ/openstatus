import { and, asc, eq, gt, inArray, isNull, lte } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
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
import { GetMonitorReportingInput } from "./schemas";

/**
 * Started status-page maintenances and maintenance windows on a policy's
 * monitors in the months `getMonitorReporting` shows, each with its mode.
 */
export async function listMonitorReportingMaintenances(args: {
  ctx: ServiceContext;
  input: GetMonitorReportingInput;
  now?: Date;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetMonitorReportingInput.parse(args.input);
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

  const [touched, windowRows] = await Promise.all([
    db
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
      .all(),
    db
      .select({
        id: monitorMaintenanceWindow.id,
        title: monitorMaintenanceWindow.title,
        mode: monitorMaintenanceWindow.mode,
        from: monitorMaintenanceWindow.from,
        to: monitorMaintenanceWindow.to,
        monitorId: monitorMaintenanceWindowToMonitor.monitorId,
      })
      .from(monitorMaintenanceWindowToMonitor)
      .innerJoin(
        monitorMaintenanceWindow,
        eq(
          monitorMaintenanceWindow.id,
          monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
        ),
      )
      .where(
        and(
          eq(monitorMaintenanceWindow.workspaceId, ctx.workspace.id),
          inArray(monitorMaintenanceWindowToMonitor.monitorId, memberIds),
          lte(monitorMaintenanceWindow.from, now),
          gt(monitorMaintenanceWindow.to, rangeStart),
        ),
      )
      .all(),
  ]);

  type Window = {
    /** page: a status-page maintenance, which pauses checks. window: a maintenance window. */
    kind: "page" | "window";
    id: number;
    title: string;
    from: Date;
    to: Date;
    pageId: number | null;
    pageTitle: string | null;
    mode: "pause" | "continue";
    monitorIds: number[];
    /** Listed once, under the month it started in, or the first month shown. */
    month: string;
    /** Every month it touches can still take an excused window. */
    excusable: boolean;
  };
  const sealed = await sealedMonthsOf(db, policy);
  const windows = new Map<string, Window>();
  const add = (
    key: string,
    row: Omit<Window, "monitorIds" | "month" | "excusable">,
    monitorId: number,
  ) => {
    const window = windows.get(key) ?? {
      ...row,
      monitorIds: [],
      month: row.from < rangeStart ? months[0] : monthOf(row.from, timeZone),
      excusable:
        policy.archivedAt === null &&
        excusedWindowLock(row, { now, sealed, timeZone }) === null,
    };
    if (!window.monitorIds.includes(monitorId)) {
      window.monitorIds.push(monitorId);
    }
    windows.set(key, window);
  };
  for (const { monitorId, ...row } of touched) {
    if (monitorId === null) continue;
    add(`page:${row.id}`, { ...row, kind: "page", mode: "pause" }, monitorId);
  }
  for (const { monitorId, ...row } of windowRows) {
    add(
      `window:${row.id}`,
      { ...row, kind: "window", pageId: null, pageTitle: null },
      monitorId,
    );
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

export type MonitorReportingMaintenances = Awaited<
  ReturnType<typeof listMonitorReportingMaintenances>
>;
