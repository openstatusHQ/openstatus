import { db, schema } from "@openstatus/db";
import type { User, Workspace } from "@openstatus/db/src/schema";

/**
 * Result of resolving the active workspace for an authenticated user.
 * Both fields are guaranteed non-null on success.
 */
export type ActiveWorkspace = {
  user: User;
  workspace: Workspace;
};

export type ResolveActiveWorkspaceFailure =
  | { kind: "user_not_found" }
  | { kind: "workspace_not_found" };

export type ResolveActiveWorkspaceResult =
  | { ok: true; value: ActiveWorkspace }
  | { ok: false; error: ResolveActiveWorkspaceFailure };

/**
 * Canonical workspace-from-cookie resolver — looks up the
 * `workspace-slug` cookie and falls back to the user's first workspace
 * when the cookie is missing or stale (cookie manipulation, deleted slug).
 */
export async function resolveActiveWorkspace(args: {
  userId: number;
  workspaceSlug?: string;
}): Promise<ResolveActiveWorkspaceResult> {
  const userAndWorkspace = await db.query.user.findFirst({
    where: { id: args.userId },
    with: { workspaces: true },
  });

  if (!userAndWorkspace) {
    return { ok: false, error: { kind: "user_not_found" } };
  }

  const { workspaces, ...userProps } = userAndWorkspace;

  const activeWorkspace =
    workspaces?.find((workspace) => {
      if (args.workspaceSlug) return workspace.slug === args.workspaceSlug;
      return true;
    }) ?? workspaces?.[0];

  if (!activeWorkspace) {
    return { ok: false, error: { kind: "workspace_not_found" } };
  }

  const user = schema.selectUserSchema.parse(userProps);
  const workspace = schema.selectWorkspaceSchema.parse(activeWorkspace);
  return { ok: true, value: { user, workspace } };
}
