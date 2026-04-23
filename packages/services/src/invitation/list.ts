import { and, db as defaultDb, eq, gte, isNull } from "@openstatus/db";
import {
  invitation,
  selectInvitationSchema,
  selectWorkspaceSchema,
} from "@openstatus/db/src/schema";

import type { ServiceContext } from "../context";
import { NotFoundError, UnauthorizedError } from "../errors";
import type { Invitation, Workspace } from "../types";
import {
  GetInvitationByTokenInput,
  type ListInvitationsInput,
} from "./schemas";

/**
 * List pending (unexpired, unaccepted) invitations for the caller's
 * workspace.
 */
export async function listInvitations(args: {
  ctx: ServiceContext;
  input?: ListInvitationsInput;
}): Promise<Invitation[]> {
  const { ctx } = args;
  const db = ctx.db ?? defaultDb;

  const rows = await db.query.invitation.findMany({
    where: and(
      eq(invitation.workspaceId, ctx.workspace.id),
      gte(invitation.expiresAt, new Date()),
      isNull(invitation.acceptedAt),
    ),
  });

  return rows as Invitation[];
}

export type InvitationWithWorkspace = Invitation & { workspace: Workspace };

/**
 * Resolve an invitation by token for a given accepting user's email.
 * Intentionally scoped by email to prevent token-sharing: a different user
 * cannot claim an invitation addressed to someone else.
 *
 * Throws `UnauthorizedError` when the email is missing (caller isn't
 * authenticated) and `NotFoundError` when no pending invite matches.
 */
export async function getInvitationByToken(args: {
  ctx: ServiceContext;
  input: GetInvitationByTokenInput;
}): Promise<InvitationWithWorkspace> {
  const input = GetInvitationByTokenInput.parse(args.input);
  const db = args.ctx.db ?? defaultDb;

  if (!input.email) {
    throw new UnauthorizedError(
      "You are not authorized to access this resource.",
    );
  }

  const result = await db.query.invitation.findFirst({
    where: and(
      eq(invitation.token, input.token),
      isNull(invitation.acceptedAt),
      gte(invitation.expiresAt, new Date()),
      eq(invitation.email, input.email),
    ),
    with: { workspace: true },
  });

  if (!result) throw new NotFoundError("invitation", input.token);

  return selectInvitationSchema
    .extend({ workspace: selectWorkspaceSchema })
    .parse(result) as InvitationWithWorkspace;
}
