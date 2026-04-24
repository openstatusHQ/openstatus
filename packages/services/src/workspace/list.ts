import { db as defaultDb, eq, isNull } from "@openstatus/db";
import {
  monitor,
  selectWorkspaceSchema,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";

import type { ServiceContext } from "../context";
import { NotFoundError } from "../errors";
import type { Workspace } from "../types";
import {
  type GetWorkspaceWithUsageInput,
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
  checks: number;
};

export type WorkspaceWithUsage = Workspace & { usage: WorkspaceUsage };

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

/**
 * Workspace plus the four usage counts the dashboard surfaces alongside plan
 * limits. Active monitors only (`deletedAt IS NULL`); notifications / pages /
 * page-components are unconditional counts scoped to the workspace.
 */
export async function getWorkspaceWithUsage(args: {
  ctx: ServiceContext;
  input?: GetWorkspaceWithUsageInput;
}): Promise<WorkspaceWithUsage> {
  const { ctx } = args;
  const db = ctx.db ?? defaultDb;

  const result = await db.query.workspace.findFirst({
    where: eq(workspace.id, ctx.workspace.id),
    with: {
      pages: {
        with: { pageComponents: true },
      },
      monitors: {
        where: isNull(monitor.deletedAt),
      },
      notifications: true,
    },
  });

  // Same guard as `getWorkspace` — unreachable in practice (workspace
  // resolved upstream) but keeps the error shape consistent with every
  // other service, rather than letting `parse(undefined)` surface as
  // a `ZodError`.
  if (!result) throw new NotFoundError("workspace", ctx.workspace.id);

  const usage: WorkspaceUsage = {
    monitors: result.monitors?.length ?? 0,
    notifications: result.notifications?.length ?? 0,
    pages: result.pages?.length ?? 0,
    pageComponents:
      result.pages?.flatMap((page) => page.pageComponents)?.length ?? 0,
    // Parity with the legacy router — checks usage was previously commented
    // out pending a real source and left as 0. Preserved here.
    checks: 0,
  };

  return { ...selectWorkspaceSchema.parse(result), usage };
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
