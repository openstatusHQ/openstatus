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
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import type {
  Page,
  PageComponent,
  StatusReport,
  StatusReportUpdate,
} from "../types";
import { getReportInWorkspace } from "./internal";
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

/**
 * Load relations for a set of status reports in three batched queries
 * (updates, component associations, pages + page components) regardless of
 * how many reports were passed in. Avoids the O(N) per-row pattern that
 * pairs badly with the dashboard's effectively-unlimited list request.
 */
async function enrichReportsBatch(
  db: DB,
  rows: StatusReport[],
): Promise<StatusReportWithRelations[]> {
  if (rows.length === 0) return [];

  const reportIds = rows.map((r) => r.id);
  const pageIdsSet = new Set<number>();
  for (const r of rows) if (r.pageId != null) pageIdsSet.add(r.pageId);
  const pageIds = Array.from(pageIdsSet);

  // One query: all updates for all reports, newest-first.
  const allUpdates = await db
    .select()
    .from(statusReportUpdate)
    .where(inArray(statusReportUpdate.statusReportId, reportIds))
    .orderBy(desc(statusReportUpdate.date))
    .all();
  const updatesByReport = new Map<number, StatusReportUpdate[]>();
  for (const u of allUpdates) {
    const arr = updatesByReport.get(u.statusReportId);
    if (arr) arr.push(u);
    else updatesByReport.set(u.statusReportId, [u]);
  }

  // One query: all component associations joined to their components.
  // Explicit column selection with aliases avoids depending on drizzle's
  // auto-derived `row.<object_name>` keys — those are named after the
  // exported JS variable, so a rename in the schema silently breaks the
  // row shape at runtime.
  const assocRows = await db
    .select({
      reportId: statusReportsToPageComponents.statusReportId,
      component: pageComponent,
    })
    .from(pageComponent)
    .innerJoin(
      statusReportsToPageComponents,
      eq(statusReportsToPageComponents.pageComponentId, pageComponent.id),
    )
    .where(inArray(statusReportsToPageComponents.statusReportId, reportIds))
    .all();
  const componentsByReport = new Map<number, PageComponent[]>();
  for (const row of assocRows) {
    const component = row.component as unknown as PageComponent;
    const arr = componentsByReport.get(row.reportId);
    if (arr) arr.push(component);
    else componentsByReport.set(row.reportId, [component]);
  }

  // Two queries: distinct pages + their component rosters. Keyed by pageId so
  // multiple reports sharing a page share the same Page object.
  const pageById = new Map<
    number,
    Page & { pageComponents: PageComponent[] }
  >();
  if (pageIds.length > 0) {
    const [pageRows, pageSiblings] = await Promise.all([
      db.select().from(pageTable).where(inArray(pageTable.id, pageIds)).all(),
      db
        .select()
        .from(pageComponent)
        .where(inArray(pageComponent.pageId, pageIds))
        .all(),
    ]);
    const siblingsByPageId = new Map<number, PageComponent[]>();
    for (const c of pageSiblings) {
      const arr = siblingsByPageId.get(c.pageId);
      if (arr) arr.push(c as unknown as PageComponent);
      else siblingsByPageId.set(c.pageId, [c as unknown as PageComponent]);
    }
    for (const p of pageRows) {
      pageById.set(p.id, {
        ...selectPageSchema.parse(p),
        pageComponents: siblingsByPageId.get(p.id) ?? [],
      });
    }
  }

  return rows.map((r) => {
    const components = componentsByReport.get(r.id) ?? [];
    return {
      ...r,
      updates: updatesByReport.get(r.id) ?? [],
      pageComponents: components,
      pageComponentIds: components.map((c) => c.id),
      page: r.pageId != null ? pageById.get(r.pageId) ?? null : null,
    };
  });
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
  const items = await enrichReportsBatch(db, rows);
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
  const [enriched] = await enrichReportsBatch(db, [report]);
  // `enrichReportsBatch` guarantees a 1:1 mapping for a non-empty input.
  // biome-ignore lint/style/noNonNullAssertion: always non-null for len === 1
  return enriched!;
}
