import { and, eq, inArray, isNull } from "@openstatus/db";
import {
  externalService,
  externalServiceComponent,
  monitor,
  page,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { ForbiddenError } from "../errors";

/** Assert a page is in the workspace. Throws `ForbiddenError` otherwise. */
export async function assertPageInWorkspace(args: {
  tx: DB;
  pageId: number;
  workspaceId: number;
}): Promise<void> {
  const { tx, pageId, workspaceId } = args;
  const row = await tx
    .select({ id: page.id })
    .from(page)
    .where(and(eq(page.id, pageId), eq(page.workspaceId, workspaceId)))
    .get();
  if (!row) throw new ForbiddenError("You don't have access to this page.");
}

/**
 * Verify the supplied monitor ids all belong to the workspace. Duplicated
 * from `monitor/internal.ts` deliberately; a shared `packages/services/src/
 * internal/` extraction is a natural follow-up once a third consumer
 * appears (tags-to-workspace may be a candidate).
 */
export async function validateMonitorIds(args: {
  tx: DB;
  workspaceId: number;
  monitorIds: ReadonlyArray<number>;
}): Promise<void> {
  const { tx, workspaceId, monitorIds } = args;
  if (monitorIds.length === 0) return;
  const ids = Array.from(new Set(monitorIds));
  // Exclude soft-deleted monitors — a deleted monitor's id shouldn't be
  // attachable to a fresh page component. Without this filter the row
  // count matches on ids pointing at rows that are already tombstoned.
  const rows = await tx
    .select({ id: monitor.id })
    .from(monitor)
    .where(
      and(
        inArray(monitor.id, ids),
        eq(monitor.workspaceId, workspaceId),
        isNull(monitor.deletedAt),
      ),
    )
    .all();
  if (rows.length !== ids.length) {
    throw new ForbiddenError("Invalid monitor IDs.");
  }
}

export async function validateExternalRefs(args: {
  tx: DB;
  serviceIds: ReadonlyArray<number>;
  componentRefs: ReadonlyArray<{ serviceId: number; componentId: number }>;
  // Newly-added service refs additionally must not be soft-deleted, so a fresh
  // pick can't reference a removed provider. Existing refs only need to exist,
  // so a provider soft-deleted after being added never blocks saving the page.
  requireLiveServiceIds?: ReadonlyArray<number>;
}): Promise<void> {
  const { tx, serviceIds, componentRefs, requireLiveServiceIds } = args;

  const ids = Array.from(new Set(serviceIds));
  if (ids.length > 0) {
    const rows = await tx
      .select({ id: externalService.id })
      .from(externalService)
      .where(inArray(externalService.id, ids))
      .all();
    if (rows.length !== ids.length) {
      throw new ForbiddenError("Invalid external service IDs.");
    }
  }

  const liveIds = Array.from(new Set(requireLiveServiceIds ?? []));
  if (liveIds.length > 0) {
    const rows = await tx
      .select({ id: externalService.id })
      .from(externalService)
      .where(
        and(
          inArray(externalService.id, liveIds),
          isNull(externalService.deletedAt),
        ),
      )
      .all();
    if (rows.length !== liveIds.length) {
      throw new ForbiddenError("Invalid external service IDs.");
    }
  }

  const componentIds = Array.from(
    new Set(componentRefs.map((r) => r.componentId)),
  );
  if (componentIds.length > 0) {
    const rows = await tx
      .select({
        id: externalServiceComponent.id,
        externalServiceId: externalServiceComponent.externalServiceId,
      })
      .from(externalServiceComponent)
      .where(inArray(externalServiceComponent.id, componentIds))
      .all();
    const serviceByComponent = new Map(
      rows.map((r) => [r.id, r.externalServiceId]),
    );
    for (const ref of componentRefs) {
      if (serviceByComponent.get(ref.componentId) !== ref.serviceId) {
        throw new ForbiddenError("Invalid external component IDs.");
      }
    }
  }
}
