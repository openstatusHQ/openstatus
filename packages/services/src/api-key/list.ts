import { db as defaultDb, eq, inArray } from "@openstatus/db";
import { apiKey, user } from "@openstatus/db/src/schema";

import type { ServiceContext } from "../context";
import type { ApiKey } from "../types";
import type { ListApiKeysInput } from "./schemas";

export type ApiKeyCreator = {
  id: number;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type ApiKeyWithCreator = ApiKey & {
  createdBy: ApiKeyCreator | undefined;
};

/**
 * List API keys for the caller's workspace with creator info batched via a
 * single IN query — replaces the legacy per-row `Promise.all` fan-out.
 */
export async function listApiKeys(args: {
  ctx: ServiceContext;
  input?: ListApiKeysInput;
}): Promise<ApiKeyWithCreator[]> {
  const { ctx } = args;
  const db = ctx.db ?? defaultDb;

  const keys = await db
    .select()
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
      ...(key as ApiKey),
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
    ...(key as ApiKey),
    createdBy: creatorsById.get(key.createdById),
  }));
}
