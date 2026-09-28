import {
  type SQL,
  and,
  asc,
  db as defaultDb,
  desc,
  eq,
  gte,
  inArray,
  sql,
} from "@openstatus/db";
import {
  monitorIncidentTable,
  monitor,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import type { MonitorIncident, Monitor } from "../types";
import { getMonitorIncidentInWorkspace } from "./internal";
import {
  GetMonitorIncidentInput,
  type MonitorIncidentListPeriod,
  ListMonitorIncidentsInput,
} from "./schemas";

function periodToSince(period: MonitorIncidentListPeriod): Date {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  switch (period) {
    case "1d":
      return new Date(now - 1 * day);
    case "7d":
      return new Date(now - 7 * day);
    case "14d":
      return new Date(now - 14 * day);
  }
}

export type MonitorIncidentWithRelations = MonitorIncident & {
  monitor: Monitor | null;
};

export type ListMonitorIncidentsResult = {
  items: MonitorIncidentWithRelations[];
  totalSize: number;
};

/**
 * Load each incident's monitor in a single IN query against distinct
 * `monitorId`s — avoids the per-row fetch that would balloon with the
 * 10_000 sentinel tRPC passes. Scoped to `workspaceId` for defence-in-depth:
 * the `incident.monitorId` column has no FK constraint against workspace
 * ownership, so a cross-workspace pointer (however unlikely) should not
 * leak the other workspace's monitor row.
 */
async function enrichIncidentsBatch(
  db: DB,
  rows: MonitorIncident[],
  workspaceId: number,
): Promise<MonitorIncidentWithRelations[]> {
  if (rows.length === 0) return [];

  const monitorIdsSet = new Set<number>();
  for (const r of rows) if (r.monitorId != null) monitorIdsSet.add(r.monitorId);
  const monitorIds = Array.from(monitorIdsSet);

  const monitorById = new Map<number, Monitor>();
  if (monitorIds.length > 0) {
    const monitorRows = await db
      .select()
      .from(monitor)
      .where(
        and(
          inArray(monitor.id, monitorIds),
          eq(monitor.workspaceId, workspaceId),
        ),
      )
      .all();
    for (const m of monitorRows) {
      monitorById.set(m.id, selectMonitorSchema.parse(m));
    }
  }

  return rows.map((r) => ({
    ...r,
    monitor:
      r.monitorId != null ? (monitorById.get(r.monitorId) ?? null) : null,
  }));
}

export async function listMonitorIncidents(args: {
  ctx: ServiceContext;
  input: ListMonitorIncidentsInput;
}): Promise<ListMonitorIncidentsResult> {
  const { ctx } = args;
  const input = ListMonitorIncidentsInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const conditions: SQL[] = [
    eq(monitorIncidentTable.workspaceId, ctx.workspace.id),
  ];
  if (input.monitorId !== undefined) {
    conditions.push(eq(monitorIncidentTable.monitorId, input.monitorId));
  }
  if (input.period !== undefined) {
    conditions.push(
      gte(monitorIncidentTable.startedAt, periodToSince(input.period)),
    );
  }
  const whereClause = and(...conditions);

  const [countRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(monitorIncidentTable)
      .where(whereClause)
      .get(),
    db
      .select()
      .from(monitorIncidentTable)
      .where(whereClause)
      .orderBy(
        input.order === "asc"
          ? asc(monitorIncidentTable.startedAt)
          : desc(monitorIncidentTable.startedAt),
      )
      .limit(input.limit)
      .offset(input.offset)
      .all(),
  ]);

  const totalSize = countRow?.count ?? 0;
  const items = await enrichIncidentsBatch(db, rows, ctx.workspace.id);
  return { items, totalSize };
}

export async function getMonitorIncident(args: {
  ctx: ServiceContext;
  input: GetMonitorIncidentInput;
}): Promise<MonitorIncidentWithRelations> {
  const { ctx } = args;
  const input = GetMonitorIncidentInput.parse(args.input);
  const db = ctx.db ?? defaultDb;
  const record = await getMonitorIncidentInWorkspace({
    tx: db,
    id: input.id,
    workspaceId: ctx.workspace.id,
  });
  const [enriched] = await enrichIncidentsBatch(db, [record], ctx.workspace.id);
  // oxlint-disable-next-line typescript/no-non-null-assertion -- always defined for len === 1
  return enriched!;
}
