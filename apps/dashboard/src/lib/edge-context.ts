import { auth } from "@/lib/auth";
import { db, eq, schema } from "@openstatus/db";
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

  const userAndWorkspace = await db.query.user.findFirst({
    where: eq(schema.user.id, userId),
    with: {
      usersToWorkspaces: {
        with: {
          workspace: true,
        },
      },
    },
  });

  if (!userAndWorkspace) return null;

  const workspaceSlugCookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("workspace-slug="))
    ?.split("=")[1];

  const activeWorkspace =
    userAndWorkspace.usersToWorkspaces?.find(({ workspace }) => {
      if (workspaceSlugCookie) return workspace.slug === workspaceSlugCookie;
      return true;
    })?.workspace ?? userAndWorkspace.usersToWorkspaces?.[0]?.workspace;

  if (!activeWorkspace) return null;

  const workspace = schema.selectWorkspaceSchema.parse(activeWorkspace);

  return {
    workspace,
    actor: { type: "user", userId },
  };
}
