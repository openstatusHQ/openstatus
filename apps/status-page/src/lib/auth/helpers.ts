import type { AdapterUser } from "next-auth/adapters";

import { db, eq } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";

export async function createUser(data: AdapterUser) {
  const { id, ...rest } = data;

  const newUser = await db
    .insert(user)
    .values({
      email: rest.email,
      name: rest.name,
    })
    .returning()
    .get();

  return newUser;
}

export async function getUser(id: string) {
  const _user = await db
    .select()
    .from(user)
    .where(eq(user.id, Number(id)))
    .get();

  return _user || null;
}
