import { apiKey } from "@openstatus/db/src/schema";
import { generateApiKey } from "@openstatus/db/src/utils/api-key";

import { emitAudit } from "../audit";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { InternalServiceError, UnauthorizedError } from "../errors";
import type { PublicApiKey } from "./list";
import { CreateApiKeyInput } from "./schemas";

/**
 * Create a new API key for the caller's workspace. Returns the plaintext
 * token *once* — the caller must display it immediately because the stored
 * hash can't be reversed.
 *
 * `createdById` is derived from `ctx.actor` rather than taken from input:
 * the column is attribution-grade data (who owns the key, who the audit
 * row points at), so letting it ride in on the wire would let any caller
 * forge ownership. Actors without a resolvable openstatus user id (system
 * / webhook, or an api-key / slack actor with no mapping yet) get a clean
 * `UnauthorizedError` instead of silently writing a bogus creator id.
 */
export async function createApiKey(args: {
  ctx: ServiceContext;
  input: CreateApiKeyInput;
}): Promise<{ token: string; key: PublicApiKey }> {
  const { ctx } = args;
  const input = CreateApiKeyInput.parse(args.input);

  const createdById = tryGetActorUserId(ctx.actor);
  if (createdById == null) {
    throw new UnauthorizedError(
      "API keys must be created by a known user actor.",
    );
  }

  const { token, prefix, hash } = await generateApiKey();

  return withTransaction(ctx, async (tx) => {
    const [key] = await tx
      .insert(apiKey)
      .values({
        name: input.name,
        description: input.description,
        prefix,
        hashedToken: hash,
        workspaceId: ctx.workspace.id,
        createdById,
        expiresAt: input.expiresAt,
      })
      .returning();

    if (!key) {
      throw new InternalServiceError("Failed to create API key");
    }

    // Narrow snapshot: `hashedToken` is a secret (bcrypt hash), and
    // `workspaceId`/`createdById`/timestamps are already derivable from
    // the row header or the actor. Keep the audit payload to the fields
    // a reader actually needs to identify which key this was.
    await emitAudit(tx, ctx, {
      action: "api_key.create",
      entityType: "api_key",
      entityId: key.id,
      after: {
        id: key.id,
        name: key.name,
        description: key.description,
        prefix: key.prefix,
        expiresAt: key.expiresAt,
      },
    });

    // Strip `hashedToken` before returning — callers only need the
    // plaintext `token` (shown once) plus the metadata row. Letting
    // the bcrypt hash ride out on the create response leaks the same
    // column `listApiKeys` already takes pains to exclude.
    const { hashedToken: _hashed, ...publicKey } = key;
    return { token, key: publicKey };
  });
}
