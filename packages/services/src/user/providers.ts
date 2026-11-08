import { db as defaultDb, eq } from "@openstatus/db";
import { account } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { ListUserProvidersInput } from "./schemas";

/** Auth providers linked to the user, one entry per `account` row. */
export async function listUserProviders(args: {
  input: ListUserProvidersInput;
  db?: DB;
}): Promise<string[]> {
  const input = ListUserProvidersInput.parse(args.input);
  const db = args.db ?? defaultDb;

  const rows = await db
    .select({ provider: account.provider })
    .from(account)
    .where(eq(account.userId, input.userId))
    .all();

  return rows.map((row) => row.provider);
}
