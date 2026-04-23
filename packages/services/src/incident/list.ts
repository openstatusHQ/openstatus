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
  incidentTable,
  monitor,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import type { Incident, Monitor } from "../types";
import { getIncidentInWorkspace } from "./internal";
import {
  GetIncidentInput,
  type IncidentListPeriod,
  ListIncidentsInput,
} from "./schemas";

function periodToSince(period: IncidentListPeriod): Date {
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

export type IncidentWithRelations = Incident & {
  monitor: Monitor | null;
};

export type ListIncidentsResult = {
  items: IncidentWithRelations[];
  totalSize: number;
};

/**
 * Load each incident's monitor in a single IN query against distinct
 * `monitorId`s — avoids the per-row fetch that would balloon with the
 * 10_000 sentinel tRPC passes.
 */
async function enrichIncidentsBatch(
  db: DB,
  rows: Incident[],
): Promise<IncidentWithRelations[]> {
  if (rows.length === 0) return [];

  const monitorIdsSet = new Set<number>();
  for (const r of rows) if (r.monitorId != null) monitorIdsSet.add(r.monitorId);
  const monitorIds = Array.from(monitorIdsSet);

  const monitorById = new Map<number, Monitor>();
  if (monitorIds.length > 0) {
    const monitorRows = await db
      .select()
      .from(monitor)
      .where(inArray(monitor.id, monitorIds))
      .all();
    for (const m of monitorRows) {
      monitorById.set(m.id, selectMonitorSchema.parse(m));
    }
  }

  return rows.map((r) => ({
    ...r,
    monitor: r.monitorId != null ? monitorById.get(r.monitorId) ?? null : null,
  }));
}

export async function listIncidents(args: {
  ctx: ServiceContext;
  input: ListIncidentsInput;
}): Promise<ListIncidentsResult> {
  const { ctx } = args;
  const input = ListIncidentsInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const conditions: SQL[] = [eq(incidentTable.workspaceId, ctx.workspace.id)];
  if (input.monitorId !== undefined) {
    conditions.push(eq(incidentTable.monitorId, input.monitorId));
  }
  if (input.period !== undefined) {
    conditions.push(gte(incidentTable.startedAt, periodToSince(input.period)));
  }
  const whereClause = and(...conditions);

  const [countRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(incidentTable)
      .where(whereClause)
      .get(),
    db
      .select()
      .from(incidentTable)
      .where(whereClause)
      .orderBy(
        input.order === "asc"
          ? asc(incidentTable.startedAt)
          : desc(incidentTable.startedAt),
      )
      .limit(input.limit)
      .offset(input.offset)
      .all(),
  ]);

  const totalSize = countRow?.count ?? 0;
  const items = await enrichIncidentsBatch(db, rows);
  return { items, totalSize };
}

export async function getIncident(args: {
  ctx: ServiceContext;
  input: GetIncidentInput;
}): Promise<IncidentWithRelations> {
  const { ctx } = args;
  const input = GetIncidentInput.parse(args.input);
  const db = ctx.db ?? defaultDb;
  const record = await getIncidentInWorkspace({
    tx: db,
    id: input.id,
    workspaceId: ctx.workspace.id,
  });
  const [enriched] = await enrichIncidentsBatch(db, [record]);
  // biome-ignore lint/style/noNonNullAssertion: always defined for len === 1
  return enriched!;
}
