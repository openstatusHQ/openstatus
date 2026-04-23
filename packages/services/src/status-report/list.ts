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
  pageComponent,
  page as pageTable,
  selectPageSchema,
  statusReport,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import type {
  Page,
  PageComponent,
  StatusReport,
  StatusReportUpdate,
} from "../types";
import { getReportInWorkspace, getUpdatesForReport } from "./internal";
import {
  GetStatusReportInput,
  ListStatusReportsInput,
  type StatusReportListPeriod,
} from "./schemas";

function periodToSince(period: StatusReportListPeriod): Date {
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

export type StatusReportWithRelations = StatusReport & {
  updates: StatusReportUpdate[];
  pageComponents: PageComponent[];
  /** Flat list of associated component ids. Convenience for proto conversion. */
  pageComponentIds: number[];
  /**
   * The owning page with its full component roster. `null` when the report
   * has no `pageId` — rare today but schema-allowed.
   */
  page: (Page & { pageComponents: PageComponent[] }) | null;
};

export type ListStatusReportsResult = {
  items: StatusReportWithRelations[];
  totalSize: number;
};

async function loadPageWithComponents(
  db: DB,
  pageId: number,
): Promise<(Page & { pageComponents: PageComponent[] }) | null> {
  const [pageRow, siblings] = await Promise.all([
    db.select().from(pageTable).where(eq(pageTable.id, pageId)).get(),
    db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.pageId, pageId))
      .all(),
  ]);
  if (!pageRow) return null;
  return {
    ...selectPageSchema.parse(pageRow),
    pageComponents: siblings as PageComponent[],
  };
}

async function enrichReport(
  db: DB,
  report: StatusReport,
): Promise<StatusReportWithRelations> {
  const [updates, components, page] = await Promise.all([
    getUpdatesForReport(db, report.id),
    db
      .select()
      .from(pageComponent)
      .innerJoin(
        statusReportsToPageComponents,
        eq(statusReportsToPageComponents.pageComponentId, pageComponent.id),
      )
      .where(eq(statusReportsToPageComponents.statusReportId, report.id))
      .all()
      .then((rows) =>
        rows.map((r) => r.page_component as unknown as PageComponent),
      ),
    report.pageId === null
      ? Promise.resolve(null)
      : loadPageWithComponents(db, report.pageId),
  ]);

  return {
    ...report,
    updates,
    pageComponents: components,
    pageComponentIds: components.map((c) => c.id),
    page,
  };
}

export async function listStatusReports(args: {
  ctx: ServiceContext;
  input: ListStatusReportsInput;
}): Promise<ListStatusReportsResult> {
  const { ctx } = args;
  const input = ListStatusReportsInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const conditions: SQL[] = [eq(statusReport.workspaceId, ctx.workspace.id)];
  if (input.statuses.length > 0) {
    conditions.push(inArray(statusReport.status, input.statuses));
  }
  if (input.pageId !== undefined) {
    conditions.push(eq(statusReport.pageId, input.pageId));
  }
  if (input.period !== undefined) {
    conditions.push(gte(statusReport.createdAt, periodToSince(input.period)));
  }
  const whereClause = and(...conditions);

  const [countRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(statusReport)
      .where(whereClause)
      .get(),
    db
      .select()
      .from(statusReport)
      .where(whereClause)
      .orderBy(
        input.order === "asc"
          ? asc(statusReport.createdAt)
          : desc(statusReport.createdAt),
      )
      .limit(input.limit)
      .offset(input.offset)
      .all(),
  ]);

  const totalSize = countRow?.count ?? 0;
  const items = await Promise.all(rows.map((r) => enrichReport(db, r)));
  return { items, totalSize };
}

export async function getStatusReport(args: {
  ctx: ServiceContext;
  input: GetStatusReportInput;
}): Promise<StatusReportWithRelations> {
  const { ctx } = args;
  const input = GetStatusReportInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const report = await getReportInWorkspace({
    tx: db,
    id: input.id,
    workspaceId: ctx.workspace.id,
  });
  return enrichReport(db, report);
}
