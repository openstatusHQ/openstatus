import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { DefaultSession } from "next-auth";
import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

// import Credentials from "next-auth/providers/credentials";

import { db } from "@openstatus/db";
import {
  account,
  session,
  user,
  verificationToken,
} from "@openstatus/db/src/schema";

// FIXME: doesnt work in Edge Runtime - TODO: create an api for this
// import { sendEmail, WelcomeEmail } from "@openstatus/emails";
// import { analytics, trackAnalytics } from "@openstatus/analytics";

import { api } from "@/trpc/server";

export type { DefaultSession };

const adapter: Adapter = {
  ...DrizzleAdapter(
    // @ts-expect-error some issues with types
    db,
    // REMINDER: default table names are prefixed with "auth_" for clerk migration
    {
      usersTable: user,
      accountsTable: account,
      sessionsTable: session,
      verificationTokensTable: verificationToken,
    },
  ),
  // TODO: interface User should extend id?: number
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: true,
  adapter,
  providers: [GitHub, Google],
  callbacks: {
    async jwt(params) {
      console.log(params);
      return params.token;
    },
    // async session(params) {
    //   return;
    // },
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

      // await sendEmail({
      //   from: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
      //   subject: "Level up your website and API monitoring.",
      //   to: [email],
      //   react: WelcomeEmail(),
      // });

      // await analytics.identify(userId, { email, userId });
      // await trackAnalytics({ event: "User Created", userId, email });
    },
    async signIn(params) {
      if (params.isNewUser) return;
      if (!params.user.id || !params.user.email) return;

      const { id: userId, email } = params.user;

      // await analytics.identify(userId, { userId, email });
      // await trackAnalytics({ event: "User Signed In" });
    },
  },
  pages: {
    signIn: "/app/login",
    // newUser: "/app/onboarding", // TODO: rethink this as we still have the `slug` to use
  },
  // basePath: "/api/auth", // default is `/api/auth`
  // secret: process.env.AUTH_SECRET, // default is `AUTH_SECRET`
});
