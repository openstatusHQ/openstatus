import { and, eq, gte, inArray } from "@openstatus/db";
import {
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
  type MonitorMaintenanceWindowMode,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";

export type HistoryMaintenanceWindow = {
  id: number;
  title: string;
  mode: MonitorMaintenanceWindowMode;
  from: Date;
  to: Date;
};

export type HistoryExcusedOutage = {
  id: number;
  from: Date;
  to: Date | null;
  reason: string | null;
};

export type HistoryAnnotations = {
  /** dashboard-only: never passed to getEvents, so no effect on uptime or the public page */
  maintenanceWindows: HistoryMaintenanceWindow[];
  /** excused outages are left out of the numbers; listed so the export can show them */
  excusedOutages: HistoryExcusedOutage[];
};

type AnnotatedComponent = {
  monitorId: number | null;
  monitor: {
    monitorIncidents: {
      id: number;
      startedAt: Date;
      resolvedAt: Date | null;
      excusedAt: Date | null;
      excusedReason: string | null;
    }[];
  } | null;
};

/** Annotations per component, in input order; nothing ending before `sinceMs`. */
export async function historyAnnotations(args: {
  db: DB;
  workspaceId: number;
  components: AnnotatedComponent[];
  sinceMs: number;
}): Promise<HistoryAnnotations[]> {
  const since = new Date(args.sinceMs);
  const monitorIds = [
    ...new Set(
      args.components.flatMap((c) =>
        c.monitorId !== null ? [c.monitorId] : [],
      ),
    ),
  ];
  const windowRows =
    monitorIds.length === 0
      ? []
      : await args.db
          .select({
            monitorId: monitorMaintenanceWindowToMonitor.monitorId,
            id: monitorMaintenanceWindow.id,
            title: monitorMaintenanceWindow.title,
            mode: monitorMaintenanceWindow.mode,
            from: monitorMaintenanceWindow.from,
            to: monitorMaintenanceWindow.to,
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
              eq(monitorMaintenanceWindow.workspaceId, args.workspaceId),
              inArray(monitorMaintenanceWindowToMonitor.monitorId, monitorIds),
              gte(monitorMaintenanceWindow.to, since),
            ),
          )
          .orderBy(monitorMaintenanceWindow.from)
          .all();

  const windowsByMonitor = new Map<number, HistoryMaintenanceWindow[]>();
  for (const { monitorId, ...window } of windowRows) {
    const list = windowsByMonitor.get(monitorId) ?? [];
    list.push(window);
    windowsByMonitor.set(monitorId, list);
  }

  return args.components.map((c) => ({
    maintenanceWindows:
      c.monitorId !== null ? (windowsByMonitor.get(c.monitorId) ?? []) : [],
    excusedOutages: (c.monitor?.monitorIncidents ?? [])
      .filter(
        (i) =>
          i.excusedAt !== null &&
          (i.resolvedAt === null || i.resolvedAt >= since),
      )
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
      .map((i) => ({
        id: i.id,
        from: i.startedAt,
        to: i.resolvedAt,
        reason: i.excusedReason,
      })),
  }));
}
