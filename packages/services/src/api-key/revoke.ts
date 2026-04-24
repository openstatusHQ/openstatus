import { and, eq } from "@openstatus/db";
import { apiKey } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { RevokeApiKeyInput } from "./schemas";

/**
 * Revoke (delete) an API key. Scoped to the caller's workspace — the
 * existence check runs inside the tx so concurrent revokes don't race to
 * a false "not found". Throws `NotFoundError` when the key doesn't exist
 * in the workspace; surface adapters map that to their transport's 404.
 */
export async function revokeApiKey(args: {
  ctx: ServiceContext;
  input: RevokeApiKeyInput;
}): Promise<void> {
  const { ctx } = args;
  const input = RevokeApiKeyInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const row = await tx
      .select({ id: apiKey.id })
      .from(apiKey)
      .where(
        and(eq(apiKey.id, input.id), eq(apiKey.workspaceId, ctx.workspace.id)),
      )
      .get();

    if (!row) throw new NotFoundError("api_key", input.id);

    await tx.delete(apiKey).where(eq(apiKey.id, input.id));

    await emitAudit(tx, ctx, {
      action: "api_key.revoke",
      entityType: "api_key",
      entityId: input.id,
    });
  });
}
