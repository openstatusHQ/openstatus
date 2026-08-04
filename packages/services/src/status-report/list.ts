import {
  type SQL,
  and,
  asc,
  db as defaultDb,
  desc,
  eq,
  gte,
  inArray,
  ne,
  or,
  sql,
} from "@openstatus/db";
import {
  type PageComponentImpact,
  pageComponent,
  page as pageTable,
  selectPageComponentSchema,
  selectPageSchema,
  statusReport,
  statusReportUpdate,
  statusReportUpdateToPageComponents,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import { type DB, type ServiceContext, batchReads } from "../context";
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

export type StatusReportUpdateWithImpacts = StatusReportUpdate & {
  /** Impacts this update set; empty for legacy reports. */
  componentImpacts: { pageComponentId: number; impact: PageComponentImpact }[];
};

export type StatusReportWithRelations = StatusReport & {
  updates: StatusReportUpdateWithImpacts[];
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
 * Load relations for a set of status reports in two round-trips regardless
 * of how many reports were passed in. Avoids the O(N) per-row pattern that
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
  // Keeps the batch a fixed four statements when no report carries a pageId;
  // `inArray` with an empty list is not a valid predicate.
  const anyPage = pageIds.length > 0 ? inArray(pageTable.id, pageIds) : sql`0`;
  const anyPageComponent =
    pageIds.length > 0 ? inArray(pageComponent.pageId, pageIds) : sql`0`;

  // Everything that keys off the reports themselves — updates, component
  // associations, owning pages and their component rosters — in one
  // round-trip. Only the impact rows below depend on a prior result.
  const [allUpdates, assocRows, pageRows, pageSiblings] = await batchReads(db, [
    db
      .select()
      .from(statusReportUpdate)
      .where(inArray(statusReportUpdate.statusReportId, reportIds))
      .orderBy(desc(statusReportUpdate.date)),
    // Explicit column selection with aliases avoids depending on drizzle's
    // auto-derived `row.<object_name>` keys — those are named after the
    // exported JS variable, so a rename in the schema silently breaks the
    // row shape at runtime.
    db
      .select({
        reportId: statusReportsToPageComponents.statusReportId,
        component: pageComponent,
      })
      .from(pageComponent)
      .innerJoin(
        statusReportsToPageComponents,
        eq(statusReportsToPageComponents.pageComponentId, pageComponent.id),
      )
      .where(inArray(statusReportsToPageComponents.statusReportId, reportIds)),
    db.select().from(pageTable).where(anyPage),
    db.select().from(pageComponent).where(anyPageComponent),
  ]);

  // One query: all impact rows for all updates.
  const updateIds = allUpdates.map((u) => u.id);
  const impactRows =
    updateIds.length > 0
      ? await db
          .select({
            statusReportUpdateId:
              statusReportUpdateToPageComponents.statusReportUpdateId,
            pageComponentId: statusReportUpdateToPageComponents.pageComponentId,
            impact: statusReportUpdateToPageComponents.impact,
          })
          .from(statusReportUpdateToPageComponents)
          .where(
            inArray(
              statusReportUpdateToPageComponents.statusReportUpdateId,
              updateIds,
            ),
          )
          .all()
      : [];
  const impactsByUpdate = new Map<
    number,
    { pageComponentId: number; impact: PageComponentImpact }[]
  >();
  for (const row of impactRows) {
    const arr = impactsByUpdate.get(row.statusReportUpdateId);
    const entry = {
      pageComponentId: row.pageComponentId,
      impact: row.impact,
    };
    if (arr) arr.push(entry);
    else impactsByUpdate.set(row.statusReportUpdateId, [entry]);
  }

  const updatesByReport = new Map<number, StatusReportUpdateWithImpacts[]>();
  for (const u of allUpdates) {
    const withImpacts = {
      ...u,
      componentImpacts: impactsByUpdate.get(u.id) ?? [],
    };
    const arr = updatesByReport.get(u.statusReportId);
    if (arr) arr.push(withImpacts);
    else updatesByReport.set(u.statusReportId, [withImpacts]);
  }

  const componentsByReport = new Map<number, PageComponent[]>();
  for (const row of assocRows) {
    const component = selectPageComponentSchema.parse(row.component);
    const arr = componentsByReport.get(row.reportId);
    if (arr) arr.push(component);
    else componentsByReport.set(row.reportId, [component]);
  }

  // Keyed by pageId so multiple reports sharing a page share the same Page.
  const pageById = new Map<
    number,
    Page & { pageComponents: PageComponent[] }
  >();
  const siblingsByPageId = new Map<number, PageComponent[]>();
  for (const c of pageSiblings) {
    const parsed = selectPageComponentSchema.parse(c);
    const arr = siblingsByPageId.get(parsed.pageId);
    if (arr) arr.push(parsed);
    else siblingsByPageId.set(parsed.pageId, [parsed]);
  }
  for (const p of pageRows) {
    pageById.set(p.id, {
      ...selectPageSchema.parse(p),
      pageComponents: siblingsByPageId.get(p.id) ?? [],
    });
  }

  return rows.map((r) => {
    const components = componentsByReport.get(r.id) ?? [];
    return {
      ...r,
      updates: updatesByReport.get(r.id) ?? [],
      pageComponents: components,
      pageComponentIds: components.map((c) => c.id),
      page: r.pageId != null ? (pageById.get(r.pageId) ?? null) : null,
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

  // `or(...)` is typed `SQL | undefined`, and `and()` drops undefined entries.
  const conditions: (SQL | undefined)[] = [
    eq(statusReport.workspaceId, ctx.workspace.id),
  ];
  if (input.statuses.length > 0) {
    conditions.push(inArray(statusReport.status, input.statuses));
  }
  if (input.pageId !== undefined) {
    conditions.push(eq(statusReport.pageId, input.pageId));
  }
  if (input.period !== undefined) {
    conditions.push(gte(statusReport.createdAt, periodToSince(input.period)));
  }
  if (input.activeOrClosedSince !== undefined) {
    conditions.push(
      or(
        ne(statusReport.status, "resolved"),
        gte(statusReport.updatedAt, input.activeOrClosedSince),
      ),
    );
  }
  const whereClause = and(...conditions);

  const rows = await db
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
    .all();

  // A short page is the last page, so the total is already known and the
  // extra `count(*)` is only paid when a full page comes back — or when an
  // empty page leaves it ambiguous whether we ran off the end. Both tRPC
  // consumers discard `totalSize` entirely.
  let totalSize = input.offset + rows.length;
  if (rows.length === input.limit || (rows.length === 0 && input.offset > 0)) {
    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(statusReport)
      .where(whereClause)
      .get();
    totalSize = countRow?.count ?? totalSize;
  }

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
  // oxlint-disable-next-line typescript/no-non-null-assertion -- always non-null for len === 1
  return enriched!;
}
