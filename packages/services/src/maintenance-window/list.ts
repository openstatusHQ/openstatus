import {
  and,
  asc,
  db as defaultDb,
  desc,
  eq,
  inArray,
  isNull,
} from "@openstatus/db";
import {
  maintenance,
  monitor,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
  page,
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
  /** Status-page maintenances announcing this window. */
  announcements: {
    id: number;
    title: string;
    pageId: number | null;
    pageTitle: string | null;
    createdAt: Date | null;
  }[];
  createdByUser: AttributedUserDetail | null;
};

async function enrich(
  db: DB,
  workspaceId: number,
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
      and(
        eq(monitor.id, monitorMaintenanceWindowToMonitor.monitorId),
        eq(monitor.workspaceId, workspaceId),
        isNull(monitor.deletedAt),
      ),
    )
    .where(
      inArray(
        monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
        rows.map((r) => r.id),
      ),
    )
    .all();
  const announced = await db
    .select({
      windowId: maintenance.monitorMaintenanceWindowId,
      id: maintenance.id,
      title: maintenance.title,
      pageId: maintenance.pageId,
      pageTitle: page.title,
      createdAt: maintenance.createdAt,
    })
    .from(maintenance)
    .leftJoin(page, eq(page.id, maintenance.pageId))
    .where(
      and(
        eq(maintenance.workspaceId, workspaceId),
        inArray(
          maintenance.monitorMaintenanceWindowId,
          rows.map((r) => r.id),
        ),
      ),
    )
    .orderBy(asc(maintenance.id))
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
      announcements: announced
        .filter((a) => a.windowId === r.id)
        .map(({ windowId: _, ...a }) => a),
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
  return enrich(db, ctx.workspace.id, rows);
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
  const [enriched] = await enrich(db, ctx.workspace.id, [row]);
  return enriched;
}
