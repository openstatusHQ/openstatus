import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter } from "next-auth/adapters";

import { db } from "@openstatus/db";
import {
  verificationToken,
  viewer,
  viewerAccounts,
  viewerSession,
} from "@openstatus/db/src/schema";

import { createUser, getUser } from "./helpers";

export const adapter: Adapter = {
  ...DrizzleAdapter(db, {
    // @ts-ignore
    usersTable: viewer,
    // NOTE: only need accounts for external providers
    // @ts-ignore
    accountsTable: viewerAccounts,
    // @ts-ignore
    sessionsTable: viewerSession,
    // @ts-ignore
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
