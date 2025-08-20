import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter } from "next-auth/adapters";

import { db } from "@openstatus/db";
import {
  account,
  session,
  user,
  verificationToken,
} from "@openstatus/db/src/schema";

import { createUser, getUser } from "./helpers";

export const adapter: Adapter = {
  // @ts-expect-error some issues with types
  ...DrizzleAdapter(db, {
    usersTable: user,
    accountsTable: account,
    sessionsTable: session,
    verificationTokensTable: verificationToken,
  }),
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
