import { resolveActiveWorkspace } from "@openstatus/api/src/auth/resolve-active-workspace";
import type { ServiceContext } from "@openstatus/services";

import { auth } from "@/lib/auth";

/**
 * Build a `ServiceContext` for a dashboard chat request. Re-uses the
 * canonical `resolveActiveWorkspace` helper that backs `enforceUserIsAuthed`
 * so both surfaces resolve the same workspace from the same `workspace-slug`
 * cookie. Returns `null` when the user is unauthenticated or has no
 * active workspace — caller renders 401.
 */
export async function getChatServiceContext(args: {
  workspaceSlug?: string;
}): Promise<ServiceContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = Number(session.user.id);
  if (!Number.isInteger(userId)) return null;

  const resolved = await resolveActiveWorkspace({
    userId,
    workspaceSlug: args.workspaceSlug,
  });
  if (!resolved.ok) return null;

  return {
    workspace: resolved.value.workspace,
    actor: { type: "user", userId },
  };
}
