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

  // Filter out any null `createdById` — the new `createApiKey` enforces
  // a non-null creator, but legacy rows (or backfills from before the
  // services migration) may have null. SQL's `x IN (NULL)` is `UNKNOWN`
  // rather than a match, so passing a nullable list wouldn't cause a
  // false positive — but drizzle's types model the array as `number[]`,
  // so sanitising upfront keeps the type honest and avoids surprises.
  const creatorIds = Array.from(
    new Set(
      keys.map((k) => k.createdById).filter((id): id is number => id != null),
    ),
  );
  // Skip the creator lookup entirely when every key pre-dates the
  // services migration (all `createdById` are null). Drizzle throws
  // `"At least one value must be provided"` for an empty `inArray`,
  // which would crash `listApiKeys` for those workspaces.
  if (creatorIds.length === 0) {
    return keys.map((key) => ({
      ...selectPublicApiKeySchema.parse(key),
      createdBy: undefined,
    }));
  }
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
