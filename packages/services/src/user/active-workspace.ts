import { db as defaultDb } from "@openstatus/db";
import {
  type User,
  type Workspace,
  selectUserSchema,
  selectWorkspaceSchema,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";

export type ActiveWorkspace = {
  user: User;
  workspace: Workspace;
  /** Every workspace the user belongs to; always contains `workspace`. */
  workspaces: Workspace[];
};

export type ResolveActiveWorkspaceFailure =
  | { kind: "user_not_found" }
  | { kind: "workspace_not_found" };

export type ResolveActiveWorkspaceResult =
  | { ok: true; value: ActiveWorkspace }
  | { ok: false; error: ResolveActiveWorkspaceFailure };

/**
 * User plus every workspace they belong to, earliest membership first.
 * Soft-deleted accounts resolve to nothing even if a session cookie survives.
 */
export async function resolveUserWorkspaces(args: {
  userId: number;
  db?: DB;
}): Promise<{ user: User; workspaces: Workspace[] } | null> {
  const db = args.db ?? defaultDb;
  const row = await db.query.user.findFirst({
    where: { id: args.userId, deletedAt: { isNull: true } },
    with: {
      usersToWorkspaces: {
        // Makes the no-cookie fallback the earliest membership, not Turso's order.
        orderBy: { createdAt: "asc" },
        with: { workspace: true },
      },
    },
  });
  if (!row) return null;
  const { usersToWorkspaces, ...userProps } = row;
  return {
    user: selectUserSchema.parse(userProps),
    workspaces: (usersToWorkspaces ?? []).map((m) =>
      selectWorkspaceSchema.parse(m.workspace),
    ),
  };
}

/**
 * Pick the workspace named by the `workspace-slug` cookie, falling back to the
 * user's earliest workspace when the cookie is missing or stale. The cookie
 * only selects among memberships, so a forged value grants nothing.
 */
export async function resolveActiveWorkspace(args: {
  userId: number;
  workspaceSlug?: string;
  db?: DB;
}): Promise<ResolveActiveWorkspaceResult> {
  const resolved = await resolveUserWorkspaces(args);
  if (!resolved) return { ok: false, error: { kind: "user_not_found" } };
  const { user, workspaces } = resolved;
  const workspace =
    (args.workspaceSlug
      ? workspaces.find((w) => w.slug === args.workspaceSlug)
      : undefined) ?? workspaces[0];
  if (!workspace) return { ok: false, error: { kind: "workspace_not_found" } };
  return { ok: true, value: { user, workspace, workspaces } };
}
