import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { analytics, trackAnalytics } from "@openstatus/analytics";
import { db } from "@openstatus/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@openstatus/db/src/schema";
import { sendEmail, WelcomeEmail } from "@openstatus/emails";

import { api } from "@/trpc/server";

// REMINDER: we can override the session type
declare module "next-auth" {
  /**
   * Returned by `auth`, `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      workspaces: string;
    } & DefaultSession["user"];
  }
}

export { DefaultSession };

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(
    // @ts-expect-error some issues with types
    db,
    // REMINDER: default table names are prefixed with "auth_" for clerk migration
    {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    },
  ),
  providers: [GitHub, Google],
  callbacks: {
    // async session(params) {
    //   return
    // }
    async signIn(params) {
      // if return false, the user is not eligible to sign in
      return true;
    },
  },
  events: {
    async createUser(params) {
      if (!params.user.id || !params.user.email) {
        throw new Error("User id & email is required");
      }

      const { id: userId, email } = params.user;

      await api.workspace.createWorkspace.mutate({ userId });

      await sendEmail({
        from: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        subject: "Level up your website and API monitoring.",
        to: [email],
        react: WelcomeEmail(),
      });

      await analytics.identify(userId, { email, userId });
      await trackAnalytics({ event: "User Created", userId, email });
    },
    async signIn(params) {
      if (params.isNewUser) return;
      if (!params.user.id || !params.user.email) return;

      const { id: userId, email } = params.user;

      await analytics.identify(userId, { userId, email });
      await trackAnalytics({ event: "User Signed In" });
    },
  },
  pages: {
    signIn: "/app/signin",
    // newUser: "/app/onboarding", // TODO: rethink this as we still have the `slug` to use
  },
});
