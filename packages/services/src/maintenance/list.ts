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
  maintenance,
  maintenancesToPageComponents,
  pageComponent,
  selectPageComponentSchema,
} from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import type { Maintenance, PageComponent } from "../types";
import { getMaintenanceInWorkspace } from "./internal";
import {
  GetMaintenanceInput,
  ListMaintenancesInput,
  type MaintenanceListPeriod,
} from "./schemas";

function periodToSince(period: MaintenanceListPeriod): Date {
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

export type MaintenanceWithRelations = Maintenance & {
  pageComponents: PageComponent[];
  pageComponentIds: number[];
};

export type ListMaintenancesResult = {
  items: MaintenanceWithRelations[];
  totalSize: number;
};

/**
 * Load component associations for a set of maintenances in a single IN
 * query, regardless of list size. Avoids the 2-queries-per-row pattern
 * that pairs badly with the dashboard's effectively-unlimited list.
 */
async function enrichMaintenancesBatch(
  db: DB,
  rows: Maintenance[],
): Promise<MaintenanceWithRelations[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  // Explicit column selection (not `select()`) keeps the row shape in our
  // hands instead of relying on drizzle's auto-derived `row.<table_name>`
  // keys, which are named after the JS variable and silently break on
  // schema rename.
  const assocRows = await db
    .select({
      maintenanceId: maintenancesToPageComponents.maintenanceId,
      component: pageComponent,
    })
    .from(pageComponent)
    .innerJoin(
      maintenancesToPageComponents,
      eq(maintenancesToPageComponents.pageComponentId, pageComponent.id),
    )
    .where(inArray(maintenancesToPageComponents.maintenanceId, ids))
    .all();

  const componentsByMaintenance = new Map<number, PageComponent[]>();
  for (const row of assocRows) {
    const component = selectPageComponentSchema.parse(row.component);
    const arr = componentsByMaintenance.get(row.maintenanceId);
    if (arr) arr.push(component);
    else componentsByMaintenance.set(row.maintenanceId, [component]);
  }

  return rows.map((r) => {
    const components = componentsByMaintenance.get(r.id) ?? [];
    return {
      ...r,
      pageComponents: components,
      pageComponentIds: components.map((c) => c.id),
    };
  });
}

export async function listMaintenances(args: {
  ctx: ServiceContext;
  input: ListMaintenancesInput;
}): Promise<ListMaintenancesResult> {
  const { ctx } = args;
  const input = ListMaintenancesInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const conditions: SQL[] = [eq(maintenance.workspaceId, ctx.workspace.id)];
  if (input.pageId !== undefined) {
    conditions.push(eq(maintenance.pageId, input.pageId));
  }
  if (input.period !== undefined) {
    conditions.push(gte(maintenance.createdAt, periodToSince(input.period)));
  }
  const whereClause = and(...conditions);

  // Count and page queries run in parallel outside a transaction — a
  // concurrent insert between them can leave `totalSize` one off from the
  // returned page. Best-effort is fine for list pagination (Connect clients
  // re-fetch; tRPC callers use a 10k sentinel and ignore totalSize).
  const [countRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(maintenance)
      .where(whereClause)
      .get(),
    db
      .select()
      .from(maintenance)
      .where(whereClause)
      .orderBy(
        input.order === "asc"
          ? asc(maintenance.createdAt)
          : desc(maintenance.createdAt),
      )
      .limit(input.limit)
      .offset(input.offset)
      .all(),
  ]);

  const totalSize = countRow?.count ?? 0;
  const items = await enrichMaintenancesBatch(db, rows);
  return { items, totalSize };
}

export async function getMaintenance(args: {
  ctx: ServiceContext;
  input: GetMaintenanceInput;
}): Promise<MaintenanceWithRelations> {
  const { ctx } = args;
  const input = GetMaintenanceInput.parse(args.input);
  const db = ctx.db ?? defaultDb;
  const record = await getMaintenanceInWorkspace({
    tx: db,
    id: input.id,
    workspaceId: ctx.workspace.id,
  });
  const [enriched] = await enrichMaintenancesBatch(db, [record]);
  // biome-ignore lint/style/noNonNullAssertion: always defined for len === 1
  return enriched!;
}
