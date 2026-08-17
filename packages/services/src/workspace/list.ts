import { and, db as defaultDb, eq, isNull, sql } from "@openstatus/db";
import {
  monitor,
  notification,
  page,
  pageComponent,
  selectWorkspaceSchema,
  statusReport,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";

import { type DB, type ServiceContext, batchReads } from "../context";
import { NotFoundError } from "../errors";
import type { Workspace } from "../types";
import {
  GetWorkspaceByStripeIdInput,
  type GetWorkspaceUsageInput,
  ListWorkspacesInput,
} from "./schemas";

/**
 * Usage snapshot shown on the workspace settings page — counts the workspace's
 * active (non-soft-deleted) monitors, notifications and pages, plus the total
 * page-component count across all pages.
 */
export type WorkspaceUsage = {
  monitors: number;
  notifications: number;
  pages: number;
  pageComponents: number;
  statusReports: number;
  checks: number;
};

/** Load the workspace the caller is scoped to. */
export async function getWorkspace(args: {
  ctx: ServiceContext;
}): Promise<Workspace> {
  const { ctx } = args;
  const db = ctx.db ?? defaultDb;

  const result = await db.query.workspace.findFirst({
    where: eq(workspace.id, ctx.workspace.id),
  });

  // Shouldn't be reachable in practice — `ctx.workspace` was already
  // resolved upstream — but guard explicitly so callers see the same
  // `NotFoundError` shape every other service throws when a row is
  // missing, rather than a `ZodError` from `parse(undefined)`.
  if (!result) throw new NotFoundError("workspace", ctx.workspace.id);

  return selectWorkspaceSchema.parse(result);
}

// Counts, not rows: the previous relational read materialized every page,
// component, monitor (with its config blobs) and notification just to call
// `.length` on them. All five are single-table and index-covered.
function usageCountQueries(db: DB, workspaceId: number) {
  const total = sql<number>`count(*)`;
  return [
    db
      .select({ count: total })
      .from(monitor)
      .where(
        and(eq(monitor.workspaceId, workspaceId), isNull(monitor.deletedAt)),
      ),
    db
      .select({ count: total })
      .from(notification)
      .where(eq(notification.workspaceId, workspaceId)),
    db
      .select({ count: total })
      .from(page)
      .where(eq(page.workspaceId, workspaceId)),
    db
      .select({ count: total })
      .from(pageComponent)
      .where(eq(pageComponent.workspaceId, workspaceId)),
    db
      .select({ count: total })
      .from(statusReport)
      .where(eq(statusReport.workspaceId, workspaceId)),
  ] as const;
}

function toUsage(rows: { count: number }[][]): WorkspaceUsage {
  const [monitors, notifications, pages, pageComponents, statusReports] = rows;
  return {
    monitors: monitors?.[0]?.count ?? 0,
    notifications: notifications?.[0]?.count ?? 0,
    pages: pages?.[0]?.count ?? 0,
    pageComponents: pageComponents?.[0]?.count ?? 0,
    statusReports: statusReports?.[0]?.count ?? 0,
    // Parity with the legacy router — checks usage was previously commented
    // out pending a real source and left as 0. Preserved here.
    checks: 0,
  };
}

/**
 * The usage counts the dashboard surfaces alongside plan limits. Active
 * monitors only (`deletedAt IS NULL`); notifications / pages / page-components
 * are unconditional counts scoped to the workspace.
 */
export async function getWorkspaceUsage(args: {
  ctx: ServiceContext;
  input?: GetWorkspaceUsageInput;
}): Promise<WorkspaceUsage> {
  const { ctx } = args;
  const db = ctx.db ?? defaultDb;

  return toUsage(await batchReads(db, usageCountQueries(db, ctx.workspace.id)));
}

/**
 * Resolve a workspace by its Stripe customer id. Runs before a
 * `ctx.workspace` exists (the Stripe webhook only holds the customer id),
 * so it takes an optional `db`/tx rather than a `ServiceContext`. Returns
 * `null` when no workspace maps to the customer — an expected case (an
 * event for a customer we don't own), which the caller maps to its own
 * error rather than a thrown `NotFoundError`.
 */
export async function getWorkspaceByStripeId(args: {
  input: GetWorkspaceByStripeIdInput;
  db?: DB;
}): Promise<Workspace | null> {
  const { stripeId } = GetWorkspaceByStripeIdInput.parse(args.input);
  const db = args.db ?? defaultDb;

  const row = await db.query.workspace.findFirst({
    where: eq(workspace.stripeId, stripeId),
  });

  return row ? selectWorkspaceSchema.parse(row) : null;
}

/**
 * Workspaces the given user belongs to. Called before `ctx.workspace` is
 * meaningful (list runs across every workspace the user has access to), so
 * the user id is passed explicitly in the input rather than read from ctx.
 */
export async function listWorkspaces(args: {
  ctx: ServiceContext;
  input: ListWorkspacesInput;
}): Promise<Workspace[]> {
  const input = ListWorkspacesInput.parse(args.input);
  const db = args.ctx.db ?? defaultDb;

  const rows = await db.query.usersToWorkspaces.findMany({
    where: eq(usersToWorkspaces.userId, input.userId),
    with: { workspace: true },
  });

  return selectWorkspaceSchema
    .array()
    .parse(rows.map(({ workspace }) => workspace));
}
