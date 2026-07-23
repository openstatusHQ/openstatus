import { and, count, eq, inArray, isNull, sql } from "@openstatus/db";
import { monitor, page } from "@openstatus/db/src/schema";
import {
  type pageAccessTypes,
  subdomainSafeList,
} from "@openstatus/db/src/schema/pages/constants";

import type { DB } from "../context";
import {
  ConflictError,
  ForbiddenError,
  LimitExceededError,
  NotFoundError,
  ValidationError,
} from "../errors";
import type { Workspace } from "../types";

/** Load a page by id, scoped to the workspace. Throws on miss. */
export async function getPageInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const { tx, id, workspaceId } = args;
  const row = await tx
    .select()
    .from(page)
    .where(and(eq(page.id, id), eq(page.workspaceId, workspaceId)))
    .get();
  if (!row) throw new NotFoundError("page", id);
  return row;
}

/** Count the workspace's pages. */
export async function countPagesInWorkspace(
  tx: DB,
  workspaceId: number,
): Promise<number> {
  const res = await tx
    .select({ count: count() })
    .from(page)
    .where(eq(page.workspaceId, workspaceId))
    .get();
  return res?.count ?? 0;
}

/**
 * Assert a slug is free — rejects reserved subdomains and already-taken
 * slugs. Optionally exempts a page id (for updates where the current slug
 * shouldn't trip the check).
 */
export async function assertSlugAvailable(args: {
  tx: DB;
  slug: string;
  excludePageId?: number;
}): Promise<void> {
  const { tx, slug, excludePageId } = args;
  if (subdomainSafeList.includes(slug)) {
    throw new ConflictError(
      "This slug is already taken. Please choose another one.",
    );
  }
  const rows = await tx
    .select({ id: page.id })
    .from(page)
    .where(sql`lower(${page.slug}) = ${slug}`)
    .all();
  const conflicts = excludePageId
    ? rows.filter((r) => r.id !== excludePageId)
    : rows;
  if (conflicts.length > 0) {
    throw new ConflictError(
      "This slug is already taken. Please choose another one.",
    );
  }
}

/** Validate monitor ids against the workspace's active (non-soft-deleted) set. */
export async function validateMonitorIdsActive(args: {
  tx: DB;
  workspaceId: number;
  monitorIds: ReadonlyArray<number>;
}): Promise<
  Array<{
    id: number;
    name: string;
    externalName: string | null;
    workspaceId: number | null;
  }>
> {
  const { tx, workspaceId, monitorIds } = args;
  if (monitorIds.length === 0) return [];
  const ids = Array.from(new Set(monitorIds));
  const rows = await tx
    .select({
      id: monitor.id,
      name: monitor.name,
      externalName: monitor.externalName,
      workspaceId: monitor.workspaceId,
    })
    .from(monitor)
    .where(
      and(
        inArray(monitor.id, ids),
        eq(monitor.workspaceId, workspaceId),
        eq(monitor.active, true),
        isNull(monitor.deletedAt),
      ),
    )
    .all();
  if (rows.length !== ids.length) {
    throw new ForbiddenError(
      "You don't have access to all the monitors or some monitors are inactive.",
    );
  }
  return rows;
}

/**
 * Plan gate for the access-type options on create / update. Mirrors the
 * existing tRPC gates.
 */
export function assertAccessTypeAllowed(
  workspace: Workspace,
  args: {
    accessType: (typeof pageAccessTypes)[number];
    passwordProtected?: boolean | null;
    allowedIpRanges?: ReadonlyArray<string> | null;
    allowIndex?: boolean;
  },
): void {
  const limits = workspace.limits;

  if (
    limits["password-protection"] === false &&
    (args.accessType === "password" || args.passwordProtected === true)
  ) {
    throw new LimitExceededError("password-protection", 0);
  }
  if (
    limits["email-domain-protection"] === false &&
    args.accessType === "email-domain"
  ) {
    throw new LimitExceededError("email-domain-protection", 0);
  }
  if (
    limits["ip-restriction"] === false &&
    args.accessType === "ip-restriction"
  ) {
    throw new LimitExceededError("ip-restriction", 0);
  }
  if (
    args.accessType === "ip-restriction" &&
    (!args.allowedIpRanges || args.allowedIpRanges.length === 0)
  ) {
    throw new ValidationError(
      "At least one IP range is required for IP restriction.",
    );
  }
  if (args.allowIndex === false && limits["no-index"] === false) {
    throw new LimitExceededError("no-index", 0);
  }
}

/** Plan gate on the workspace's `status-pages` cap. */
export async function assertStatusPageQuota(
  tx: DB,
  workspace: Workspace,
): Promise<void> {
  const current = await countPagesInWorkspace(tx, workspace.id);
  if (current >= workspace.limits["status-pages"]) {
    throw new LimitExceededError(
      "status-pages",
      workspace.limits["status-pages"],
    );
  }
}
