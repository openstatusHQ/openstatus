import { and, db, eq, isNull, schema } from "@openstatus/db";
import type { User, Workspace } from "@openstatus/db/src/schema";

/**
 * Result of resolving the active workspace for an authenticated user.
 * All fields are guaranteed non-null on success.
 */
export type ActiveWorkspace = {
  user: User;
  workspace: Workspace;
  /**
   * Every workspace the user belongs to — the resolver already joins them
   * to pick the active one, so `workspace.list` needs no query of its own.
   * Always contains `workspace`.
   */
  workspaces: Workspace[];
};

export type ResolveActiveWorkspaceFailure =
  | { kind: "user_not_found" }
  | { kind: "workspace_not_found" };

export type ResolveActiveWorkspaceResult =
  | { ok: true; value: ActiveWorkspace }
  | { ok: false; error: ResolveActiveWorkspaceFailure };

/**
 * User plus every workspace they belong to, without electing an active one.
 * Soft-deleted accounts resolve to nothing even if a session cookie survives.
 */
export async function resolveUserWorkspaces(args: {
  userId: number;
}): Promise<{ user: User; workspaces: Workspace[] } | null> {
  const row = await db.query.user.findFirst({
    where: and(eq(schema.user.id, args.userId), isNull(schema.user.deletedAt)),
    with: { usersToWorkspaces: { with: { workspace: true } } },
  });
  if (!row) return null;
  const { usersToWorkspaces, ...userProps } = row;
  return {
    user: schema.selectUserSchema.parse(userProps),
    workspaces: (usersToWorkspaces ?? []).map((m) =>
      schema.selectWorkspaceSchema.parse(m.workspace),
    ),
  };
}

/**
 * Canonical workspace-from-cookie resolver — looks up the
 * `workspace-slug` cookie and falls back to the user's first workspace
 * when the cookie is missing or stale (cookie manipulation, deleted slug).
 */
export async function resolveActiveWorkspace(args: {
  userId: number;
  workspaceSlug?: string;
}): Promise<ResolveActiveWorkspaceResult> {
  const resolved = await resolveUserWorkspaces({ userId: args.userId });
  if (!resolved) {
    return { ok: false, error: { kind: "user_not_found" } };
  }
  const { user, workspaces } = resolved;

  const workspace =
    workspaces.find((w) =>
      args.workspaceSlug ? w.slug === args.workspaceSlug : true,
    ) ?? workspaces[0];
  if (!workspace) {
    return { ok: false, error: { kind: "workspace_not_found" } };
  }
  return { ok: true, value: { user, workspace, workspaces } };
}
