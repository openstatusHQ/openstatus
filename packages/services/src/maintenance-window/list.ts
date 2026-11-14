import { and, db as defaultDb, desc, eq, inArray } from "@openstatus/db";
import {
  monitor,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
} from "@openstatus/db/src/schema";

import { type AttributedUserDetail, loadAttributedUsers } from "../attribution";
import { requireScope } from "../auth";
import type { DB, ServiceContext } from "../context";
import { getMaintenanceWindowInWorkspace } from "./internal";
import {
  GetMaintenanceWindowInput,
  ListMaintenanceWindowsInput,
} from "./schemas";

type WindowRow = typeof monitorMaintenanceWindow.$inferSelect;

export type MaintenanceWindowWithRelations = WindowRow & {
  monitors: { id: number; name: string }[];
  monitorIds: number[];
  createdByUser: AttributedUserDetail | null;
};

async function enrich(
  db: DB,
  rows: WindowRow[],
): Promise<MaintenanceWindowWithRelations[]> {
  if (rows.length === 0) return [];
  const links = await db
    .select({
      windowId: monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
      id: monitor.id,
      name: monitor.name,
    })
    .from(monitorMaintenanceWindowToMonitor)
    .innerJoin(
      monitor,
      eq(monitor.id, monitorMaintenanceWindowToMonitor.monitorId),
    )
    .where(
      inArray(
        monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
        rows.map((r) => r.id),
      ),
    )
    .all();
  const users = await loadAttributedUsers(
    db,
    rows.map((r) => r.createdBy),
  );
  const byWindow = new Map<number, { id: number; name: string }[]>();
  for (const { windowId, ...m } of links) {
    const list = byWindow.get(windowId);
    if (list) list.push(m);
    else byWindow.set(windowId, [m]);
  }
  return rows.map((r) => {
    const monitors = byWindow.get(r.id) ?? [];
    return {
      ...r,
      monitors,
      monitorIds: monitors.map((m) => m.id),
      createdByUser:
        r.createdBy != null ? (users.get(r.createdBy) ?? null) : null,
    };
  });
}

/** Newest start first; with `monitorId`, only windows that cover it. */
export async function listMaintenanceWindows(args: {
  ctx: ServiceContext;
  input?: ListMaintenanceWindowsInput;
}): Promise<MaintenanceWindowWithRelations[]> {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = ListMaintenanceWindowsInput.parse(args.input ?? {});
  const db = ctx.db ?? defaultDb;

  const rows = await db
    .select()
    .from(monitorMaintenanceWindow)
    .where(
      and(
        eq(monitorMaintenanceWindow.workspaceId, ctx.workspace.id),
        input.monitorId !== undefined
          ? inArray(
              monitorMaintenanceWindow.id,
              db
                .select({
                  id: monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
                })
                .from(monitorMaintenanceWindowToMonitor)
                .where(
                  eq(
                    monitorMaintenanceWindowToMonitor.monitorId,
                    input.monitorId,
                  ),
                ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(monitorMaintenanceWindow.from))
    .all();
  return enrich(db, rows);
}

export async function getMaintenanceWindow(args: {
  ctx: ServiceContext;
  input: GetMaintenanceWindowInput;
}): Promise<MaintenanceWindowWithRelations> {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetMaintenanceWindowInput.parse(args.input);
  const db = ctx.db ?? defaultDb;
  const row = await getMaintenanceWindowInWorkspace({
    tx: db,
    id: input.id,
    workspaceId: ctx.workspace.id,
  });
  const [enriched] = await enrich(db, [row]);
  return enriched;
}
