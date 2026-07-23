import type { Scope } from "@openstatus/db/src/schema";

import type { ServiceContext } from "../context";
import { ForbiddenError } from "../errors";
import { matchesScope } from "./matches-scope";

/**
 * Assert that the current actor holds `required` scope. Throws
 * `ForbiddenError` on mismatch; returns silently on success.
 *
 * Behavior by actor type:
 *
 * | Actor                                     | Behavior                  |
 * | ----------------------------------------- | ------------------------- |
 * | `apiKey`, `mcp`                           | Active — checks scopes    |
 * | `user`                                    | No-op (dashboard session) |
 * | `system`, `slack`, `webhook`, `subscriber`| No-op (own trust boundary)|
 *
 * Member-role enforcement for `user` actors is a separate project.
 *
 * Place this as the first line of a write verb, before `withTransaction`.
 * A failed check shouldn't open a tx just to roll it back, and the
 * check has no DB dependency.
 */
export function requireScope(ctx: ServiceContext, required: Scope): void {
  const { actor } = ctx;

  if (actor.type !== "apiKey" && actor.type !== "mcp") {
    return;
  }

  if (matchesScope(actor.scopes, required)) {
    return;
  }

  // Observability for denied attempts. Per the plan: no audit row,
  // console.warn flows through the existing log pipeline. `userId` is
  // included so a leaked-key incident response can pivot to the
  // creator without a separate join. Held scopes are joined as a
  // comma-list for friendlier rendering in log aggregators that strip
  // quotes from JSON-ish payloads.
  const heldStr = actor.scopes.length > 0 ? actor.scopes.join(",") : "(none)";
  console.warn(
    `[requireScope] denied: actor=${actor.type} keyId=${actor.keyId} userId=${actor.userId ?? "null"} workspaceId=${ctx.workspace.id} required=${required} held=${heldStr}`,
  );

  throw new ForbiddenError(`API key lacks required scope: ${required}`);
}
