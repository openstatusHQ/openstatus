import { and, eq, isNull, ne, sql } from "@openstatus/db";
import { user, usersToWorkspaces } from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb } from "../context";
import { FindMemberByEmailInput } from "./schemas";

/**
 * The one live member with this email, case-insensitively, else `null`.
 * Ambiguity is `null` too: callers use this to attribute, never to guess.
 */
export async function findMemberIdByEmail(args: {
  ctx: ServiceContext;
  input: FindMemberByEmailInput;
}): Promise<number | null> {
  const input = FindMemberByEmailInput.parse(args.input);
  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  const rows = await getReadDb(args.ctx)
    .select({ id: user.id })
    .from(usersToWorkspaces)
    .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
    .where(
      and(
        eq(usersToWorkspaces.workspaceId, args.ctx.workspace.id),
        isNull(user.deletedAt),
        ne(user.email, ""),
        sql`lower(${user.email}) = ${email}`,
      ),
    )
    .limit(2)
    .all();
  return rows.length === 1 ? rows[0].id : null;
}
