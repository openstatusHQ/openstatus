import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@openstatus/db";
import {
  account,
  session,
  user,
  verificationToken,
} from "@openstatus/db/src/schema";
import type { Adapter } from "next-auth/adapters";

import { createUser, getUser, normalizeEmail } from "./helpers";

const drizzleAdapter = DrizzleAdapter(db, {
  // @ts-expect-error: problem with type
  usersTable: user,
  // @ts-expect-error: problem with type
  accountsTable: account,
  // @ts-expect-error: problem with type
  sessionsTable: session,
  verificationTokensTable: verificationToken,
}) as Adapter;

export const adapter: Adapter = {
  ...drizzleAdapter,
  // Auth.js lowercases magic-link addresses while OAuth profiles arrive as-is;
  // without this a mixed-case OAuth user gets a second account on first
  // magic-link sign-in.
  getUserByEmail: (email) =>
    drizzleAdapter.getUserByEmail?.(normalizeEmail(email)) ?? null,
  createUser: async (data) => {
    const user = await createUser(data);
    return {
      ...user,
      id: user.id.toString(),
      email: user.email || "",
    };
  },
  getUser: async (id) => {
    const user = await getUser(id);
    if (!user) return null;
    return {
      ...user,
      id: user.id.toString(),
      email: user.email || "",
    };
  },
};
