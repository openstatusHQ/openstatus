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
  // @ts-expect-error some issues with types
  createUser: async (data) => {
    return await createUser(data);
  },
  // @ts-expect-error some issues with types
  getUser: async (id) => {
    return await getUser(id);
  },
};
