import { and, db as defaultDb, eq, isNull } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { MarkUserTrialedInput } from "./schemas";

/** Records that the user used their trial. Keeps the first date on redelivery. */
export async function markUserTrialed(args: {
  input: MarkUserTrialedInput;
  db?: DB;
}): Promise<void> {
  const input = MarkUserTrialedInput.parse(args.input);
  const db = args.db ?? defaultDb;

  await db
    .update(user)
    .set({ trialedAt: new Date() })
    .where(and(eq(user.id, input.userId), isNull(user.trialedAt)))
    .run();
}
