import { and, db as defaultDb, eq, isNull } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";

import type { ServiceContext } from "../context";
import { GetUserInput } from "./schemas";

export type UserRecord = typeof user.$inferSelect;

/**
 * Load an active (non-soft-deleted) user by id. Returns `undefined` when
 * the user doesn't exist or is soft-deleted — matches the legacy router
 * which surfaced the raw lookup result to the client.
 */
export async function getUser(args: {
  ctx: ServiceContext;
  input: GetUserInput;
}): Promise<UserRecord | undefined> {
  const input = GetUserInput.parse(args.input);
  const db = args.ctx.db ?? defaultDb;

  const row = await db
    .select()
    .from(user)
    .where(and(eq(user.id, input.userId), isNull(user.deletedAt)))
    .get();

  return row;
}
