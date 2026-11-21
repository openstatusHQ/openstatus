import {
  and,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  lte,
  type SQL,
  sql,
} from "drizzle-orm";

import type { db as defaultDb } from "./db";
import * as schema from "./schema";
import type { MonitorMaintenanceWindowMode } from "./schema";

type Db = Pick<typeof defaultDb, "select">;

// Migration period: from this instant only maintenance windows pause checks.
// Once it has passed, delete the status-page branches below.
export const PAGE_MAINTENANCE_PAUSE_ENDS = new Date("2027-01-01T00:00:00.000Z");

export function pageMaintenancePauses(at: Date): boolean {
  return at < PAGE_MAINTENANCE_PAUSE_ENDS;
}

function windowMonitorIds(
  db: Db,
  at: Date,
  mode?: MonitorMaintenanceWindowMode,
) {
  const w = schema.monitorMaintenanceWindow;
  const link = schema.monitorMaintenanceWindowToMonitor;
  return db
    .select({ id: link.monitorId })
    .from(link)
    .innerJoin(w, eq(w.id, link.monitorMaintenanceWindowId))
    .where(
      and(mode ? eq(w.mode, mode) : undefined, lte(w.from, at), gt(w.to, at)),
    );
}

// IS NOT NULL is load-bearing: `x NOT IN (…, NULL)` is NULL and drops every monitor
function pageMaintenanceMonitorIds(db: Db, at: Date) {
  const m = schema.maintenance;
  const link = schema.maintenancesToPageComponents;
  const pc = schema.pageComponent;
  return (
    db
      .select({ id: pc.monitorId })
      .from(link)
      .innerJoin(m, eq(m.id, link.maintenanceId))
      .innerJoin(pc, eq(pc.id, link.pageComponentId))
      // status-page maintenances keep their inclusive end; windows are half-open
      .where(and(lte(m.from, at), gte(m.to, at), isNotNull(pc.monitorId)))
  );
}

/**
 * Condition on `monitor.id` at `at`.
 * `pause`: a pause window covers it, or until `PAGE_MAINTENANCE_PAUSE_ENDS` a status-page
 * maintenance, and no continue window does.
 * `continue`: a continue window covers it. `window`: any window, status-page maintenances excluded.
 */
export function monitorInMaintenance(
  db: Db,
  args: { at: Date; mode: MonitorMaintenanceWindowMode | "window" },
): SQL {
  const id = schema.monitor.id;
  if (args.mode === "window") return inArray(id, windowMonitorIds(db, args.at));
  const continued = inArray(id, windowMonitorIds(db, args.at, "continue"));
  if (args.mode === "continue") return continued;
  const byWindow = inArray(id, windowMonitorIds(db, args.at, "pause"));
  const paused = pageMaintenancePauses(args.at)
    ? sql`(${byWindow} or ${inArray(id, pageMaintenanceMonitorIds(db, args.at))})`
    : byWindow;
  return sql`(${paused} and not ${continued})`;
}

export type ActiveMaintenance = {
  mode: MonitorMaintenanceWindowMode;
  source: "window" | "status_page";
  /** latest end among the covering entries in that mode */
  until: Date;
};

/** Per monitor, what covers it at `at`, by the same precedence as `monitorInMaintenance`. */
export async function activeMaintenanceByMonitor(
  db: Db,
  workspaceId: number,
  monitorIds: readonly number[],
  at: Date,
): Promise<Map<number, ActiveMaintenance>> {
  const out = new Map<number, ActiveMaintenance>();
  if (monitorIds.length === 0) return out;
  const w = schema.monitorMaintenanceWindow;
  const link = schema.monitorMaintenanceWindowToMonitor;
  const m = schema.maintenance;
  const mLink = schema.maintenancesToPageComponents;
  const pc = schema.pageComponent;

  const [windows, pageMaintenances] = await Promise.all([
    db
      .select({ monitorId: link.monitorId, mode: w.mode, to: w.to })
      .from(link)
      .innerJoin(w, eq(w.id, link.monitorMaintenanceWindowId))
      .where(
        and(
          eq(w.workspaceId, workspaceId),
          inArray(link.monitorId, [...monitorIds]),
          lte(w.from, at),
          gt(w.to, at),
        ),
      ),
    pageMaintenancePauses(at)
      ? db
          .select({ monitorId: pc.monitorId, to: m.to })
          .from(mLink)
          .innerJoin(m, eq(m.id, mLink.maintenanceId))
          .innerJoin(pc, eq(pc.id, mLink.pageComponentId))
          .where(
            and(
              eq(m.workspaceId, workspaceId),
              inArray(pc.monitorId, [...monitorIds]),
              lte(m.from, at),
              gte(m.to, at),
            ),
          )
      : [],
  ]);

  const rows: (ActiveMaintenance & { monitorId: number })[] = [
    ...windows.map((r) => ({
      monitorId: r.monitorId,
      mode: r.mode,
      source: "window" as const,
      until: r.to,
    })),
    ...pageMaintenances.flatMap((r) =>
      r.monitorId === null
        ? []
        : [
            {
              monitorId: r.monitorId,
              mode: "pause" as const,
              source: "status_page" as const,
              until: r.to,
            },
          ],
    ),
  ];
  for (const r of rows) {
    const prev = out.get(r.monitorId);
    const wins =
      !prev ||
      (prev.mode === "pause" && r.mode === "continue") ||
      (prev.mode === r.mode && prev.until < r.until);
    if (wins) {
      out.set(r.monitorId, { mode: r.mode, source: r.source, until: r.until });
    }
  }
  return out;
}
