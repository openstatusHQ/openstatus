import { db } from "@openstatus/db";
import { usersToWorkspaces } from "@openstatus/db/src/schema";
import {
  getWorkspaceByWorkosOrganization,
  isEmailAllowedForWorkspace,
} from "@openstatus/services/sso";

export type WorkOSSsoProfile = {
  organization_id?: string;
  email?: string;
};

export function readWorkOSProfile(profile: unknown): WorkOSSsoProfile {
  if (typeof profile !== "object" || profile === null) return {};
  const record: Record<string, unknown> = { ...profile };
  return {
    organization_id:
      typeof record.organization_id === "string"
        ? record.organization_id
        : undefined,
    email: typeof record.email === "string" ? record.email : undefined,
  };
}

/**
 * Authorize an SSO sign-in. The IdP controls the asserted email attribute, so
 * an address outside the workspace's verified domains must never mint a
 * session — otherwise one customer's IdP admin could reach any account.
 */
export async function authorizeSsoSignIn(
  profile: WorkOSSsoProfile,
): Promise<boolean> {
  const { organization_id: organizationId, email } = profile;
  if (!organizationId || !email) return false;

  const workspace = await getWorkspaceByWorkosOrganization(
    db,
    organizationId,
  ).catch(() => null);

  if (!workspace || !workspace.ssoEnabled) return false;

  return isEmailAllowedForWorkspace(workspace.id, email, db);
}

/**
 * Add the user to the SSO workspace. Runs from `events.signIn`, the first point
 * where `user.id` is a real row id.
 *
 * The organization is re-resolved here rather than carried over from the
 * authorize step, and `onConflictDoNothing` keeps repeat logins idempotent —
 * which also means SSO never demotes an existing owner.
 */
export async function joinWorkspaceViaSso(args: {
  organizationId: string;
  userId: number;
}): Promise<void> {
  const workspace = await getWorkspaceByWorkosOrganization(
    db,
    args.organizationId,
  ).catch(() => null);

  if (!workspace || !workspace.ssoEnabled) return;

  await db
    .insert(usersToWorkspaces)
    .values({
      userId: args.userId,
      workspaceId: workspace.id,
      role: "member",
    })
    .onConflictDoNothing();
}
