import type { ServiceContext } from "@openstatus/services";
import { resolveActiveWorkspace } from "@openstatus/services/user";

import { auth } from "@/lib/auth";
import { WORKSPACE_SLUG_COOKIE } from "@/lib/workspace-cookie";

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

  // Use slice rather than split("=")[1] so values containing "=" (e.g.
  // base64-padded variants in other flows) survive intact.
  const workspaceSlug = (() => {
    const raw = req.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${WORKSPACE_SLUG_COOKIE}=`));
    return raw ? raw.slice(raw.indexOf("=") + 1) : undefined;
  })();

  // A stale cookie falls back to the earliest workspace, as in tRPC.
  const resolved = await resolveActiveWorkspace({ userId, workspaceSlug });
  if (!resolved.ok) return null;
  const { workspace } = resolved.value;

  return {
    workspace,
    actor: { type: "user", userId },
  };
}
