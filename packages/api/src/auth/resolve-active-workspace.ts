import { db, eq, schema } from "@openstatus/db";
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
 * Canonical workspace-from-cookie resolver — looks up the
 * `workspace-slug` cookie and falls back to the user's first workspace
 * when the cookie is missing or stale (cookie manipulation, deleted slug).
 */
export async function resolveActiveWorkspace(args: {
  userId: number;
  workspaceSlug?: string;
}): Promise<ResolveActiveWorkspaceResult> {
  const userAndWorkspace = await db.query.user.findFirst({
    where: eq(schema.user.id, args.userId),
    with: {
      usersToWorkspaces: {
        with: { workspace: true },
      },
    },
  });

  if (!userAndWorkspace) {
    return { ok: false, error: { kind: "user_not_found" } };
  }

  const { usersToWorkspaces, ...userProps } = userAndWorkspace;

  const activeWorkspace =
    usersToWorkspaces?.find(({ workspace }) => {
      if (args.workspaceSlug) return workspace.slug === args.workspaceSlug;
      return true;
    })?.workspace ?? usersToWorkspaces?.[0]?.workspace;

  if (!activeWorkspace) {
    return { ok: false, error: { kind: "workspace_not_found" } };
  }

  const user = schema.selectUserSchema.parse(userProps);
  const workspace = schema.selectWorkspaceSchema.parse(activeWorkspace);
  const workspaces = (usersToWorkspaces ?? []).map((row) =>
    schema.selectWorkspaceSchema.parse(row.workspace),
  );
  return { ok: true, value: { user, workspace, workspaces } };
}
