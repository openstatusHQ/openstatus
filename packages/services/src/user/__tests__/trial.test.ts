import { db, eq } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";
import { createUser } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { markUserTrialed } from "../index.ts";

async function trialedAt(userId: number) {
  const row = await db
    .select({ trialedAt: user.trialedAt })
    .from(user)
    .where(eq(user.id, userId))
    .get();
  return row?.trialedAt;
}

describe("markUserTrialed", () => {
  test("sets trialedAt once and keeps the first date", async () => {
    const u = await createUser();
    expect(await trialedAt(u.id)).toBeNull();

    const first = new Date("2026-01-01T00:00:00Z");
    await db.update(user).set({ trialedAt: first }).where(eq(user.id, u.id));
    await markUserTrialed({ input: { userId: u.id } });
    expect(await trialedAt(u.id)).toEqual(first);
  });

  test("stamps a user who never trialed", async () => {
    const u = await createUser();
    await markUserTrialed({ input: { userId: u.id } });
    expect(await trialedAt(u.id)).toBeInstanceOf(Date);
  });
});
