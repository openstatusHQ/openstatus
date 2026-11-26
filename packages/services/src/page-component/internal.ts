import { and, eq, inArray } from "@openstatus/db";
import {
  monitor,
  page,
  pageComponent,
  pageComponentGroup,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { findMissingMonitorId } from "../monitor/internal";

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

/** Load a component by id, scoped to the workspace. */
export async function getPageComponentInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const { tx, id, workspaceId } = args;
  const row = await tx
    .select()
    .from(pageComponent)
    .where(
      and(eq(pageComponent.id, id), eq(pageComponent.workspaceId, workspaceId)),
    )
    .get();
  if (!row) throw new NotFoundError("page_component", id);
  return row;
}

/**
 * Assert a group exists and sits on `pageId`. Workspace scope alone isn't
 * enough — a group from a sibling page would otherwise be accepted and the
 * component would render under a group it isn't on. Reported as not-found
 * so the check doesn't confirm the group exists on another page.
 */
export async function assertGroupOnPage(args: {
  tx: DB;
  groupId: number;
  pageId: number;
  workspaceId: number;
}): Promise<void> {
  const { tx, groupId, pageId, workspaceId } = args;
  const row = await tx
    .select({ pageId: pageComponentGroup.pageId })
    .from(pageComponentGroup)
    .where(
      and(
        eq(pageComponentGroup.id, groupId),
        eq(pageComponentGroup.workspaceId, workspaceId),
      ),
    )
    .get();
  if (!row || row.pageId !== pageId) {
    throw new NotFoundError("page_component_group", groupId);
  }
}

/** Throws `NotFoundError` for the first id that is not a live monitor of the workspace. */
export async function validateMonitorIds(args: {
  tx: DB;
  workspaceId: number;
  monitorIds: ReadonlyArray<number>;
}): Promise<void> {
  const missing = await findMissingMonitorId({
    tx: args.tx,
    workspaceId: args.workspaceId,
    ids: [...args.monitorIds],
  });
  if (missing !== undefined) throw new NotFoundError("monitor", missing);
}

// Ping details are private and a heartbeat has no latency to chart, so the
// public monitor pages never show one.
export async function assertNoPublicHeartbeat(args: {
  tx: DB;
  workspaceId: number;
  monitorIds: ReadonlyArray<number>;
}): Promise<void> {
  if (args.monitorIds.length === 0) return;
  const row = await args.tx
    .select({ id: monitor.id })
    .from(monitor)
    .where(
      and(
        eq(monitor.workspaceId, args.workspaceId),
        eq(monitor.jobType, "heartbeat"),
        inArray(monitor.id, [...args.monitorIds]),
      ),
    )
    .get();
  if (row) {
    throw new ValidationError("Heartbeat monitors cannot be public");
  }
}
