import { db as defaultDb, eq, inArray } from "@openstatus/db";
import { apiKey, selectApiKeySchema, user } from "@openstatus/db/src/schema";

import type { ServiceContext } from "../context";
import type { ApiKey } from "../types";
import type { ListApiKeysInput } from "./schemas";

/**
 * Public projection schema — derived from `selectApiKeySchema` so column /
 * default changes flow through. Stripping `hashedToken` here means the
 * bcrypt hash never reaches a list response, even by accident.
 */
const selectPublicApiKeySchema = selectApiKeySchema.omit({
  hashedToken: true,
});

export type ApiKeyCreator = {
  id: number;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

/**
 * Public projection of an `ApiKey` — strips the bcrypt `hashedToken`
 * column so it never leaves the service boundary. Clients of
 * `listApiKeys` see everything they need to manage a key (id, name,
 * prefix, createdAt, lastUsedAt, …) but not the secret material.
 */
export type PublicApiKey = Omit<ApiKey, "hashedToken">;

export type ApiKeyWithCreator = PublicApiKey & {
  createdBy: ApiKeyCreator | undefined;
};

/**
 * List API keys for the caller's workspace with creator info batched via a
 * single IN query — replaces the legacy per-row `Promise.all` fan-out.
 *
 * Explicit column select (not `select()`) is load-bearing: the
 * `hashedToken` column holds the bcrypt hash of the one-time token and
 * has no business appearing in a list response. Returning `SELECT *`
 * would leak it to every UI consuming the list endpoint.
 */
export async function listApiKeys(args: {
  ctx: ServiceContext;
  input?: ListApiKeysInput;
}): Promise<ApiKeyWithCreator[]> {
  const { ctx } = args;
  const db = ctx.db ?? defaultDb;

  const keys = await db
    .select({
      id: apiKey.id,
      workspaceId: apiKey.workspaceId,
      name: apiKey.name,
      description: apiKey.description,
      prefix: apiKey.prefix,
      createdById: apiKey.createdById,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
    })
    .from(apiKey)
    .where(eq(apiKey.workspaceId, ctx.workspace.id))
    .all();

  if (keys.length === 0) return [];

  const creatorIds = Array.from(new Set(keys.map((k) => k.createdById)));
  const creators = await db
    .select({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    })
    .from(user)
    .where(inArray(user.id, creatorIds))
    .all();

  const creatorsById = new Map(creators.map((c) => [c.id, c]));

  return keys.map((key) => ({
    ...selectPublicApiKeySchema.parse(key),
    createdBy: creatorsById.get(key.createdById),
  }));
}
