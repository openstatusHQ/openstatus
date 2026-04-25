import {
  and,
  asc,
  db as defaultDb,
  desc,
  eq,
  inArray,
  sql,
} from "@openstatus/db";
import {
  maintenance,
  page,
  pageComponent,
  pageComponentGroup,
  selectMaintenanceSchema,
  selectPageComponentGroupSchema,
  selectPageComponentSchema,
  selectPageSchema,
  selectStatusReportSchema,
  statusReport,
} from "@openstatus/db/src/schema";

import { subdomainSafeList } from "@openstatus/db/src/schema/pages/constants";
import type { ServiceContext } from "../context";
import { NotFoundError } from "../errors";
import type { Maintenance, Page, PageComponent, StatusReport } from "../types";
import { getPageInWorkspace } from "./internal";
import { GetPageInput, GetSlugAvailableInput, ListPagesInput } from "./schemas";

type PageComponentGroupRow = typeof pageComponentGroup.$inferSelect;

export type PageListItem = Page & {
  statusReports: StatusReport[];
};

export type PageWithRelations = Page & {
  maintenances: Maintenance[];
  pageComponents: PageComponent[];
  pageComponentGroups: PageComponentGroupRow[];
};

export async function listPages(args: {
  ctx: ServiceContext;
  input: ListPagesInput;
}): Promise<PageListItem[]> {
  const { ctx } = args;
  const input = ListPagesInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const pageRows = await db
    .select()
    .from(page)
    .where(eq(page.workspaceId, ctx.workspace.id))
    .orderBy(input.order === "asc" ? asc(page.createdAt) : desc(page.createdAt))
    .all();
  if (pageRows.length === 0) return [];

  const pageIds = pageRows.map((p) => p.id);

  const reportRows = await db
    .select()
    .from(statusReport)
    .where(
      and(
        eq(statusReport.workspaceId, ctx.workspace.id),
        inArray(statusReport.pageId, pageIds),
      ),
    )
    .all();

  const reportsByPage = new Map<number, StatusReport[]>();
  for (const r of reportRows) {
    if (r.pageId == null) continue;
    const arr = reportsByPage.get(r.pageId);
    const parsed = selectStatusReportSchema.parse(r);
    if (arr) arr.push(parsed);
    else reportsByPage.set(r.pageId, [parsed]);
  }

  return pageRows.map((p) => ({
    ...selectPageSchema.parse(p),
    statusReports: reportsByPage.get(p.id) ?? [],
  }));
}

export async function getPage(args: {
  ctx: ServiceContext;
  input: GetPageInput;
}): Promise<PageWithRelations> {
  const { ctx } = args;
  const input = GetPageInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const record = await getPageInWorkspace({
    tx: db,
    id: input.id,
    workspaceId: ctx.workspace.id,
  });

  const [maintenanceRows, componentRows, groupRows] = await Promise.all([
    db
      .select()
      .from(maintenance)
      .where(
        and(
          eq(maintenance.pageId, record.id),
          eq(maintenance.workspaceId, ctx.workspace.id),
        ),
      )
      .all(),
    db
      .select()
      .from(pageComponent)
      .where(
        and(
          eq(pageComponent.pageId, record.id),
          eq(pageComponent.workspaceId, ctx.workspace.id),
        ),
      )
      .all(),
    db
      .select()
      .from(pageComponentGroup)
      .where(
        and(
          eq(pageComponentGroup.pageId, record.id),
          eq(pageComponentGroup.workspaceId, ctx.workspace.id),
        ),
      )
      .all(),
  ]);

  return {
    ...selectPageSchema.parse(record),
    maintenances: maintenanceRows.map((m) => selectMaintenanceSchema.parse(m)),
    pageComponents: componentRows.map((c) =>
      selectPageComponentSchema.parse(c),
    ),
    pageComponentGroups: groupRows.map((g) =>
      selectPageComponentGroupSchema.parse(g),
    ),
  };
}

/**
 * Narrow "just the customDomain" read, scoped to the caller's workspace.
 *
 * The tRPC `updateCustomDomain` procedure needs the *pre-update* domain
 * so it can call Vercel add/remove before the db write — it can't use
 * the `existingDomain` returned from `updatePageCustomDomain` because
 * Vercel needs the old value up front. Using `getPage` (the full-
 * relations read) here would fire 3 extra batched queries for
 * maintenances / pageComponents / pageComponentGroups we don't need.
 * This one-column select replaces that with a single indexed lookup.
 */
export async function getPageCustomDomain(args: {
  ctx: ServiceContext;
  input: GetPageInput;
}): Promise<string> {
  const { ctx } = args;
  const input = GetPageInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const row = await db
    .select({ customDomain: page.customDomain })
    .from(page)
    .where(and(eq(page.id, input.id), eq(page.workspaceId, ctx.workspace.id)))
    .get();

  if (!row) throw new NotFoundError("page", input.id);
  return row.customDomain;
}

/**
 * Cross-workspace lookup of a page by slug. Returns the raw row (not parsed
 * via `selectPageSchema`) because callers in the public status-page render
 * path expect the DB shape (`authEmailDomains` / `allowedIpRanges` as
 * comma-joined strings rather than arrays). Workspace scoping is the
 * caller's responsibility — slugs are globally unique, so the lookup
 * intentionally ignores `ctx.workspace`.
 */
export async function getPageBySlug(args: {
  input: { slug: string };
}): Promise<typeof page.$inferSelect | undefined> {
  const slug = args.input.slug.toLowerCase();
  return defaultDb.select().from(page).where(eq(page.slug, slug)).get();
}

/** Returns `true` when the slug is free (not reserved, not taken). */
export async function getSlugAvailable(args: {
  ctx: ServiceContext;
  input: GetSlugAvailableInput;
}): Promise<boolean> {
  const { ctx } = args;
  const input = GetSlugAvailableInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  if (subdomainSafeList.includes(input.slug)) return false;
  const rows = await db
    .select({ id: page.id })
    .from(page)
    .where(sql`lower(${page.slug}) = ${input.slug}`)
    .all();
  return rows.length === 0;
}
