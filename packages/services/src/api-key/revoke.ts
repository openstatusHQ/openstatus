import { and, eq } from "@openstatus/db";
import { apiKey } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { RevokeApiKeyInput } from "./schemas";

/**
 * Revoke (delete) an API key. Scoped to the caller's workspace — the
 * existence check runs inside the tx so concurrent revokes don't race to
 * a false "not found". Throws `NotFoundError` when the key doesn't exist
 * in the workspace; surface adapters map that to their transport's 404.
 *
 * Self-revoke carve-out: a read-only key is allowed to revoke *itself*.
 * Without it, a leaked read-only key has no rotation path other than the
 * dashboard, which is a UX trap (users hit `DELETE /v1/api-key/{id}`,
 * get 403, get confused). The carve-out is narrow — only the actor's
 * own key — and the audit row still captures who revoked what.
 */
export async function revokeApiKey(args: {
  ctx: ServiceContext;
  input: RevokeApiKeyInput;
}): Promise<void> {
  const { ctx } = args;
  const input = RevokeApiKeyInput.parse(args.input);

  const isSelfRevoke =
    (ctx.actor.type === "apiKey" || ctx.actor.type === "mcp") &&
    String(input.id) === ctx.actor.keyId;
  if (!isSelfRevoke) requireScope(ctx, "write");

  await withTransaction(ctx, async (tx) => {
    // Narrow select: matches the fields we put in the audit `before`
    // snapshot. `hashedToken` stays off the wire even within the tx,
    // and `workspaceId` is implied by the WHERE clause.
    // Field order mirrors `createApiKey`'s `after` snapshot so a
    // reviewer eyeballing create/delete pairs can spot drift at a
    // glance. `hashedToken` (secret) and `workspaceId`/`createdById`/
    // timestamps (already on the row header or in the actor) stay
    // out by design.
    const row = await tx
      .select({
        id: apiKey.id,
        name: apiKey.name,
        description: apiKey.description,
        prefix: apiKey.prefix,
        expiresAt: apiKey.expiresAt,
        scopes: apiKey.scopes,
      })
      .from(apiKey)
      .where(
        and(eq(apiKey.id, input.id), eq(apiKey.workspaceId, ctx.workspace.id)),
      )
      .get();

    if (!row) throw new NotFoundError("api_key", input.id);

    await tx.delete(apiKey).where(eq(apiKey.id, input.id));

    await emitAudit(tx, ctx, {
      action: "api_key.delete",
      entityType: "api_key",
      entityId: input.id,
      before: row,
    });
  });
}
