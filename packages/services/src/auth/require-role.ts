import type { WorkspaceRole } from "@openstatus/db/src/schema";

import { type DB, type ServiceContext, tryGetActorUserId } from "../context";
import { ForbiddenError } from "../errors";
import { getMembership } from "../member/membership";

/**
 * Assert the actor's workspace role is one of `roles`, or that the actor is
 * `orUserId`. `system` always passes; key-based actors without a linked user
 * pass only member-level checks.
 */
export async function requireRole(
  db: DB,
  ctx: ServiceContext,
  roles: ReadonlyArray<WorkspaceRole>,
  opts: { orUserId?: number | null } = {},
): Promise<void> {
  const { actor } = ctx;
  if (actor.type === "system") return;

  const userId = tryGetActorUserId(actor);
  if (userId !== null) {
    if (opts.orUserId != null && opts.orUserId === userId) return;
    const membership = await getMembership(db, userId, ctx.workspace.id);
    if (membership && roles.includes(membership.role)) return;
    throw new ForbiddenError(`Requires one of the roles: ${roles.join(", ")}`);
  }

  if (
    (actor.type === "apiKey" || actor.type === "mcp") &&
    roles.includes("member")
  ) {
    return;
  }
  throw new ForbiddenError(`Requires one of the roles: ${roles.join(", ")}`);
}
