import { and, db as defaultDb, eq, isNotNull } from "@openstatus/db";
import {
  selectWorkspaceSchema,
  workspace,
  workspaceSsoDomain,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import type { Workspace } from "../types";

export function normalizeSsoDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  const domain = trimmed.includes("@")
    ? trimmed.slice(trimmed.lastIndexOf("@") + 1)
    : trimmed;
  return domain.length > 0 ? domain : null;
}

/**
 * Resolve the SSO-enabled workspace that owns a *verified* domain.
 *
 * Unverified rows are never matched: `verifiedAt` mirrors WorkOS's verified
 * state, and that DNS proof is what stops one workspace claiming another's
 * domain.
 */
export async function getWorkspaceByVerifiedSsoDomain(
  emailOrDomain: string,
  db: DB = defaultDb,
): Promise<Workspace | null> {
  const domain = normalizeSsoDomain(emailOrDomain);
  if (!domain) return null;

  const row = await db
    .select({ workspace })
    .from(workspaceSsoDomain)
    .innerJoin(workspace, eq(workspace.id, workspaceSsoDomain.workspaceId))
    .where(
      and(
        eq(workspaceSsoDomain.domain, domain),
        isNotNull(workspaceSsoDomain.verifiedAt),
        eq(workspace.ssoEnabled, true),
        isNotNull(workspace.workosOrganizationId),
      ),
    )
    .get();

  if (!row) return null;

  return selectWorkspaceSchema.parse(row.workspace);
}

/**
 * Authorization check for an SSO callback: the IdP controls the asserted email
 * attribute, so an address outside the workspace's verified domains must be
 * rejected before a session is created.
 */
export async function isEmailAllowedForWorkspace(
  workspaceId: number,
  email: string,
  db: DB = defaultDb,
): Promise<boolean> {
  const domain = normalizeSsoDomain(email);
  if (!domain) return false;

  const row = await db
    .select({ id: workspaceSsoDomain.id })
    .from(workspaceSsoDomain)
    .where(
      and(
        eq(workspaceSsoDomain.workspaceId, workspaceId),
        eq(workspaceSsoDomain.domain, domain),
        isNotNull(workspaceSsoDomain.verifiedAt),
      ),
    )
    .get();

  return Boolean(row);
}
