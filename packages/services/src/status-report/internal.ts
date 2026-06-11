import { and, asc, desc, eq, inArray, notInArray } from "@openstatus/db";
import {
  type PageComponentImpact,
  pageComponent,
  statusReport,
  statusReportUpdate,
  statusReportUpdateToPageComponents,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";

export type ValidatedPageComponents = {
  componentIds: number[];
  /**
   * The page all components belong to. `null` when no components were
   * requested (empty input → report is not tied to a page via components).
   */
  pageId: number | null;
};

/**
 * Validate that every id in `pageComponentIds` exists, belongs to the
 * workspace, and — if there is more than one — that they all belong to the
 * same page. Returns the canonical numeric ids and the derived pageId.
 *
 * Must run inside the caller's transaction when used as part of a mutation to
 * close the TOCTOU window between validation and association writes.
 */
export async function validatePageComponentIds(args: {
  tx: DB;
  workspaceId: number;
  pageComponentIds: ReadonlyArray<number>;
}): Promise<ValidatedPageComponents> {
  const { tx, workspaceId, pageComponentIds } = args;
  if (pageComponentIds.length === 0) {
    return { componentIds: [], pageId: null };
  }

  // Dedupe up-front — duplicate ids in the input would violate the composite
  // PK on `status_reports_to_page_components` during insert.
  const ids = Array.from(new Set(pageComponentIds));
  const valid = await tx
    .select({ id: pageComponent.id, pageId: pageComponent.pageId })
    .from(pageComponent)
    .where(
      and(
        inArray(pageComponent.id, ids),
        eq(pageComponent.workspaceId, workspaceId),
      ),
    )
    .all();

  const validById = new Map(valid.map((c) => [c.id, c.pageId]));
  for (const id of ids) {
    if (!validById.has(id)) {
      throw new NotFoundError("page_component", id);
    }
  }

  const pageIds = new Set(valid.map((c) => c.pageId));
  if (pageIds.size > 1) {
    throw new ConflictError(
      "All page components must belong to the same page.",
    );
  }

  return { componentIds: ids, pageId: valid[0]?.pageId ?? null };
}

/** Replace the set of page-component associations for a report. */
export async function updatePageComponentAssociations(args: {
  tx: DB;
  statusReportId: number;
  componentIds: ReadonlyArray<number>;
}): Promise<void> {
  const { tx, statusReportId, componentIds } = args;

  await tx
    .delete(statusReportsToPageComponents)
    .where(eq(statusReportsToPageComponents.statusReportId, statusReportId));

  if (componentIds.length > 0) {
    await tx.insert(statusReportsToPageComponents).values(
      componentIds.map((pageComponentId) => ({
        statusReportId,
        pageComponentId,
      })),
    );
  }
}

/**
 * Drop impact rows across all of a report's updates for components outside
 * the given membership set — upholds the invariant that every impact row's
 * component is in the report's membership (folds would resurrect them).
 */
export async function pruneImpactRowsOutsideMembership(args: {
  tx: DB;
  statusReportId: number;
  componentIds: ReadonlyArray<number>;
}): Promise<void> {
  const { tx, statusReportId, componentIds } = args;
  const reportUpdateIds = tx
    .select({ id: statusReportUpdate.id })
    .from(statusReportUpdate)
    .where(eq(statusReportUpdate.statusReportId, statusReportId));

  const onReportUpdates = inArray(
    statusReportUpdateToPageComponents.statusReportUpdateId,
    reportUpdateIds,
  );

  await tx
    .delete(statusReportUpdateToPageComponents)
    .where(
      componentIds.length === 0
        ? onReportUpdates
        : and(
            onReportUpdates,
            notInArray(statusReportUpdateToPageComponents.pageComponentId, [
              ...componentIds,
            ]),
          ),
    );
}

/** Load a status report by id, scoped to the workspace. Throws on miss. */
export async function getReportInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const { tx, id, workspaceId } = args;
  const row = await tx
    .select()
    .from(statusReport)
    .where(
      and(eq(statusReport.id, id), eq(statusReport.workspaceId, workspaceId)),
    )
    .get();
  if (!row) throw new NotFoundError("status_report", id);
  return row;
}

/**
 * Load a status report update and verify its parent report belongs to the
 * workspace. Used by mutation services that target a single update row.
 */
export async function getReportUpdateInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const { tx, id, workspaceId } = args;
  const row = await tx
    .select({
      update: statusReportUpdate,
      reportWorkspaceId: statusReport.workspaceId,
    })
    .from(statusReportUpdate)
    .innerJoin(
      statusReport,
      eq(statusReportUpdate.statusReportId, statusReport.id),
    )
    .where(eq(statusReportUpdate.id, id))
    .get();
  if (!row) throw new NotFoundError("status_report_update", id);
  if (row.reportWorkspaceId !== workspaceId) {
    throw new ForbiddenError(
      "Status report update does not belong to this workspace.",
    );
  }
  return row.update;
}

/** Fetch all updates for a report, newest-first. */
export async function getUpdatesForReport(tx: DB, statusReportId: number) {
  return tx
    .select()
    .from(statusReportUpdate)
    .where(eq(statusReportUpdate.statusReportId, statusReportId))
    .orderBy(desc(statusReportUpdate.date))
    .all();
}

/** Stable ordering for audit snapshots — diffing is array-order-sensitive. */
export function sortComponentImpacts<T extends { pageComponentId: number }>(
  impacts: ReadonlyArray<T>,
): T[] {
  return [...impacts].sort((a, b) => a.pageComponentId - b.pageComponentId);
}

/** Fetch the impact rows a single update set, sorted for snapshots. */
export async function getComponentImpactsForUpdate(
  tx: DB,
  statusReportUpdateId: number,
): Promise<{ pageComponentId: number; impact: PageComponentImpact }[]> {
  const rows = await tx
    .select({
      pageComponentId: statusReportUpdateToPageComponents.pageComponentId,
      impact: statusReportUpdateToPageComponents.impact,
    })
    .from(statusReportUpdateToPageComponents)
    .where(
      eq(
        statusReportUpdateToPageComponents.statusReportUpdateId,
        statusReportUpdateId,
      ),
    )
    .all();
  return sortComponentImpacts(rows);
}

/** Insert the impact rows an update sets. No-op on empty. */
export async function insertUpdateComponentImpacts(args: {
  tx: DB;
  statusReportUpdateId: number;
  componentImpacts: ReadonlyArray<{
    pageComponentId: number;
    impact: PageComponentImpact;
  }>;
}): Promise<void> {
  const { tx, statusReportUpdateId, componentImpacts } = args;
  if (componentImpacts.length === 0) return;

  await tx.insert(statusReportUpdateToPageComponents).values(
    componentImpacts.map(({ pageComponentId, impact }) => ({
      statusReportUpdateId,
      pageComponentId,
      impact,
    })),
  );
}

/**
 * Current impact per component: the latest update (by `date`, ties by id)
 * that names it wins. Empty map ⇒ legacy report (no impact rows).
 */
export async function getCurrentImpactsForReport(
  tx: DB,
  statusReportId: number,
): Promise<Map<number, PageComponentImpact>> {
  const rows = await tx
    .select({
      pageComponentId: statusReportUpdateToPageComponents.pageComponentId,
      impact: statusReportUpdateToPageComponents.impact,
    })
    .from(statusReportUpdateToPageComponents)
    .innerJoin(
      statusReportUpdate,
      eq(
        statusReportUpdateToPageComponents.statusReportUpdateId,
        statusReportUpdate.id,
      ),
    )
    .where(eq(statusReportUpdate.statusReportId, statusReportId))
    .orderBy(asc(statusReportUpdate.date), asc(statusReportUpdate.id))
    .all();

  const current = new Map<number, PageComponentImpact>();
  for (const row of rows) {
    current.set(row.pageComponentId, row.impact);
  }
  return current;
}

/** Fetch the associated component ids for a report. */
export async function getPageComponentIdsForReport(
  tx: DB,
  statusReportId: number,
) {
  const rows = await tx
    .select({ pageComponentId: statusReportsToPageComponents.pageComponentId })
    .from(statusReportsToPageComponents)
    .where(eq(statusReportsToPageComponents.statusReportId, statusReportId))
    .all();
  return rows.map((r) => r.pageComponentId);
}
