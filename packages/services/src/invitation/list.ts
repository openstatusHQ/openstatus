import { db as defaultDb, sql } from "@openstatus/db";
import {
  selectInvitationSchema,
  selectWorkspaceSchema,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import type { ServiceContext } from "../context";
import { NotFoundError } from "../errors";
import type { Invitation, Workspace } from "../types";
import {
  GetInvitationByTokenInput,
  GetInvitationInput,
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
  requireScope(args.ctx, "admin");
  const { ctx } = args;
  const db = ctx.db ?? defaultDb;

  const rows = await db.query.invitation.findMany({
    where: {
      workspaceId: ctx.workspace.id,
      expiresAt: { gte: new Date() },
      acceptedAt: { isNull: true },
    },
  });

  return rows.map((r) => selectInvitationSchema.parse(r));
}

export type InvitationWithWorkspace = Invitation & { workspace: Workspace };

/**
 * Resolve an invitation by token for a given accepting user's email.
 * Intentionally scoped by email to prevent token-sharing: a different user
 * cannot claim an invitation addressed to someone else.
 *
 * The email is a required, zod-validated field on the input schema — the
 * transport layer (router) is responsible for short-circuiting with its
 * own auth error when the caller isn't authenticated. Throws
 * `NotFoundError` when no pending invite matches the token + email.
 */
export async function getInvitationByToken(args: {
  ctx: ServiceContext;
  input: GetInvitationByTokenInput;
}): Promise<InvitationWithWorkspace> {
  requireScope(args.ctx, "admin");
  const input = GetInvitationByTokenInput.parse(args.input);
  const db = args.ctx.db ?? defaultDb;

  const result = await db.query.invitation.findFirst({
    where: {
      token: input.token,
      acceptedAt: { isNull: true },
      expiresAt: { gte: new Date() },
      // Rows created before emails were normalized keep their original casing.
      RAW: (t) => sql`lower(${t.email}) = ${input.email}`,
    },
    with: { workspace: true },
  });

  if (!result) throw new NotFoundError("invitation", input.token);

  return selectInvitationSchema
    .extend({ workspace: selectWorkspaceSchema })
    .parse(result);
}

/** One invitation of the caller's workspace, in any state. */
export async function getInvitation(args: {
  ctx: ServiceContext;
  input: GetInvitationInput;
}): Promise<Invitation> {
  const { ctx } = args;
  requireScope(ctx, "admin");
  const input = GetInvitationInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const row = await db.query.invitation.findFirst({
    where: { id: input.id, workspaceId: ctx.workspace.id },
  });
  if (!row) throw new NotFoundError("invitation", input.id);
  return selectInvitationSchema.parse(row);
}
