import {
  type SQL,
  and,
  asc,
  db as defaultDb,
  desc,
  eq,
  gte,
  sql,
} from "@openstatus/db";
import { maintenance } from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import type { Maintenance, PageComponent } from "../types";
import {
  getMaintenanceInWorkspace,
  getPageComponentIdsForMaintenance,
  getPageComponentsForMaintenance,
} from "./internal";
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

async function enrichMaintenance(
  db: DB,
  record: Maintenance,
): Promise<MaintenanceWithRelations> {
  const [components, pageComponentIds] = await Promise.all([
    getPageComponentsForMaintenance(db, record.id),
    getPageComponentIdsForMaintenance(db, record.id),
  ]);
  return { ...record, pageComponents: components, pageComponentIds };
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
  const items = await Promise.all(rows.map((r) => enrichMaintenance(db, r)));
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
  return enrichMaintenance(db, record);
}
