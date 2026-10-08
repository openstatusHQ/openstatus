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

import type { DB } from "../context";
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
 * The workspace a signup trial can be started on: owned by the user, on the
 * free plan, and never linked to Stripe. Runs at signup, before any
 * `ctx.workspace` is resolved.
 */
export async function findTrialEligibleWorkspace(args: {
  input: OwnedWorkspacesInput;
  db?: DB;
}): Promise<Workspace | null> {
  const input = OwnedWorkspacesInput.parse(args.input);
  const db = args.db ?? defaultDb;

  const row = await db
    .select({ workspace })
    .from(usersToWorkspaces)
    .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
    .where(
      and(
        eq(usersToWorkspaces.userId, input.userId),
        eq(usersToWorkspaces.role, "owner"),
        isNull(workspace.stripeId),
        isNull(workspace.subscriptionId),
        // A fresh signup workspace has no plan column yet — that is free.
        or(isNull(workspace.plan), eq(workspace.plan, "free")),
      ),
    )
    .get();

  return row ? selectWorkspaceSchema.parse(row.workspace) : null;
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
