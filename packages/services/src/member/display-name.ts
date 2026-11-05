import { and, eq, isNull } from "@openstatus/db";
import { user, usersToWorkspaces } from "@openstatus/db/src/schema";

import { displayName } from "../attribution";
import { type ServiceContext, getReadDb } from "../context";
import { GetMemberDisplayNameInput } from "./schemas";

/** The display name of a live member of this workspace, or `null`. */
export async function getMemberDisplayName(args: {
  ctx: ServiceContext;
  input: GetMemberDisplayNameInput;
}): Promise<string | null> {
  const input = GetMemberDisplayNameInput.parse(args.input);
  const row = await getReadDb(args.ctx)
    .select({
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    })
    .from(usersToWorkspaces)
    .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
    .where(
      and(
        eq(usersToWorkspaces.workspaceId, args.ctx.workspace.id),
        eq(usersToWorkspaces.userId, input.userId),
        isNull(user.deletedAt),
      ),
    )
    .get();
  return row ? displayName(row) : null;
}
