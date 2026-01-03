import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter } from "next-auth/adapters";

import { db } from "@openstatus/db";
import {
  verificationToken,
  viewer,
  viewerAccounts,
  viewerSession,
} from "@openstatus/db/src/schema";

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
};
