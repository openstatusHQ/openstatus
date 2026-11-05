import {
  and,
  db as defaultDb,
  eq,
  isNotNull,
  isNull,
  or,
} from "@openstatus/db";
import {
  selectWorkspaceSchema,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import type { DB, ServiceContext } from "../context";
import type { Workspace } from "../types";
import { OwnedWorkspacesInput } from "./schemas";

const DAY_MS = 86_400_000;

/** Whole days until the trial ends, or `null` when there is no live trial. */
export function getTrialDaysLeft(
  trialEndsAt: Date | null | undefined,
  now = Date.now(),
): number | null {
  if (!trialEndsAt) return null;
  const msLeft = trialEndsAt.getTime() - now;
  if (msLeft <= 0) return null;
  return Math.ceil(msLeft / DAY_MS);
}

/**
 * Whether the actor can start a trial on `ctx.workspace`: they own it, it is
 * on the free plan and it never had a subscription or a trial. A Stripe
 * customer alone (an abandoned checkout) does not disqualify.
 */
export async function isTrialEligibleWorkspace(args: {
  ctx: ServiceContext;
}): Promise<boolean> {
  const { ctx } = args;
  const db = ctx.db ?? defaultDb;
  const userId = "userId" in ctx.actor ? ctx.actor.userId : undefined;
  if (!userId) return false;

  const row = await db
    .select({ id: workspace.id })
    .from(usersToWorkspaces)
    .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
    .where(
      and(
        eq(usersToWorkspaces.userId, userId),
        eq(usersToWorkspaces.workspaceId, ctx.workspace.id),
        eq(usersToWorkspaces.role, "owner"),
        isNull(workspace.subscriptionId),
        isNull(workspace.trialEndsAt),
        isNull(workspace.trialedAt),
        // A fresh signup workspace has no plan column yet — that is free.
        or(isNull(workspace.plan), eq(workspace.plan, "free")),
      ),
    )
    .get();

  return row !== undefined;
}

/**
 * Records that the workspace used its trial. Keeps the first date on
 * redelivery; returns false when it was already marked.
 */
export async function markWorkspaceTrialed(args: {
  ctx: ServiceContext;
}): Promise<boolean> {
  const { ctx } = args;
  requireScope(ctx, "admin");
  const db = ctx.db ?? defaultDb;

  const rows = await db
    .update(workspace)
    .set({ trialedAt: new Date() })
    .where(and(eq(workspace.id, ctx.workspace.id), isNull(workspace.trialedAt)))
    .returning({ id: workspace.id })
    .all();
  return rows.length > 0;
}

/** Workspaces the user owns that are mid-trial. */
export async function listOwnedTrialWorkspaces(args: {
  input: OwnedWorkspacesInput;
  db?: DB;
}): Promise<Workspace[]> {
  const input = OwnedWorkspacesInput.parse(args.input);
  const db = args.db ?? defaultDb;

  const rows = await db
    .select({ workspace })
    .from(usersToWorkspaces)
    .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
    .where(
      and(
        eq(usersToWorkspaces.userId, input.userId),
        eq(usersToWorkspaces.role, "owner"),
        isNotNull(workspace.trialEndsAt),
      ),
    )
    .all();

  return selectWorkspaceSchema.array().parse(rows.map((r) => r.workspace));
}
