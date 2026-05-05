import { auth } from "@/lib/auth";
import { asc, db, eq, schema } from "@openstatus/db";
import type { ServiceContext } from "@openstatus/services";

/**
 * Build a `ServiceContext` from a Next.js Edge Route Handler request.
 * Resolves session → user → workspace from the request, mirroring the
 * shape that tRPC's `enforceUserIsAuthed` middleware produces.
 *
 * Returns `null` when the caller is unauthenticated or has no
 * accessible workspace — route handlers should return 401/404 in that case.
 */
export async function getServiceContextFromRequest(
  req: Request,
): Promise<ServiceContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = Number(session.user.id);
  if (Number.isNaN(userId)) return null;

  // `orderBy` on the join makes the no-cookie fallback below deterministic:
  // `usersToWorkspaces[0]` is the user's earliest membership instead of
  // whatever order Turso happens to return.
  const userAndWorkspace = await db.query.user.findFirst({
    where: eq(schema.user.id, userId),
    with: {
      usersToWorkspaces: {
        orderBy: (t) => asc(t.createdAt),
        with: {
          workspace: true,
        },
      },
    },
  });

  if (!userAndWorkspace) return null;

  // Use slice rather than split("=")[1] so values containing "=" (e.g.
  // base64-padded variants in other flows) survive intact.
  const workspaceSlugCookie = (() => {
    const raw = req.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("workspace-slug="));
    return raw ? raw.slice(raw.indexOf("=") + 1) : undefined;
  })();

  // Fall back to first workspace when the cookie is stale (slug renamed,
  // user removed) — matches `enforceUserIsAuthed` in tRPC.
  const activeWorkspace = workspaceSlugCookie
    ? userAndWorkspace.usersToWorkspaces?.find(
        ({ workspace }) => workspace.slug === workspaceSlugCookie,
      )?.workspace ?? userAndWorkspace.usersToWorkspaces?.[0]?.workspace
    : userAndWorkspace.usersToWorkspaces?.[0]?.workspace;

  if (!activeWorkspace) return null;

  const workspace = schema.selectWorkspaceSchema.parse(activeWorkspace);

  return {
    workspace,
    actor: { type: "user", userId },
  };
}
