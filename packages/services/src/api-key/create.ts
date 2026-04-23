import { apiKey } from "@openstatus/db/src/schema";
import { generateApiKey } from "@openstatus/db/src/utils/api-key";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { InternalServiceError } from "../errors";
import type { ApiKey } from "../types";
import { CreateApiKeyInput } from "./schemas";

/**
 * Create a new API key for the caller's workspace. Returns the plaintext
 * token *once* — the caller must display it immediately because the stored
 * hash can't be reversed.
 */
export async function createApiKey(args: {
  ctx: ServiceContext;
  input: CreateApiKeyInput;
}): Promise<{ token: string; key: ApiKey }> {
  const { ctx } = args;
  const input = CreateApiKeyInput.parse(args.input);

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
        createdById: input.createdById,
        expiresAt: input.expiresAt,
      })
      .returning();

    if (!key) {
      throw new InternalServiceError("Failed to create API key");
    }

    await emitAudit(tx, ctx, {
      action: "api_key.create",
      entityType: "api_key",
      entityId: key.id,
      metadata: { name: input.name },
    });

    return { token, key: key as ApiKey };
  });
}
