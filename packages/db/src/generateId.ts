// INFO: To be run once to generate a unique id for the user schema

import { eq } from "drizzle-orm";
import { generateId } from "lucia";

import { db } from "./db";
import { user } from "./schema/users/user";

const AllUsers = await db.select().from(user).all();
for (const u of AllUsers) {
  await db
    .update(user)
    .set({ id: generateId(15) })
    .where(eq(user.primaryId, u.primaryId));
}
