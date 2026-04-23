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
    ...(key as ApiKey),
    createdBy: creatorsById.get(key.createdById),
  }));
}
