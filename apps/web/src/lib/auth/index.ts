import type { DefaultSession } from "next-auth";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { analytics, trackAnalytics } from "@openstatus/analytics";
// import Credentials from "next-auth/providers/credentials";

import { db, eq } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";
import { sendEmail, WelcomeEmail } from "@openstatus/emails";

import { adapter } from "./adapter";

export type { DefaultSession };

export const { handlers, signIn, signOut, auth } = NextAuth({
  // debug: true,
  adapter,
  providers: [
    GitHub({ allowDangerousEmailAccountLinking: true }),
    Google({
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          // See https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
          prompt: "select_account",
          // scope:
          //   "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
        },
      },
    }),
  ],
  callbacks: {
    async signIn(params) {
      // We keep updating the user info when we loggin in

      if (params.account?.provider === "google") {
        if (!params.profile) return true;
        if (Number.isNaN(Number(params.user.id))) return true;

        console.log(params.profile);

        await db
          .update(user)
          .set({
            firstName: params.profile.given_name,
            lastName: params.profile.family_name,
            photoUrl: params.profile.picture,
            // keep the name in sync
            name: `${params.profile.given_name} ${params.profile.family_name}`,
          })
          .where(eq(user.id, Number(params.user.id)))
          .run();
      }
      if (params.account?.provider === "github") {
        if (!params.profile) return true;
        if (Number.isNaN(Number(params.user.id))) return true;

        console.log(params.profile);

        await db
          .update(user)
          .set({
            name: params.profile.name,
            photoUrl: String(params.profile.avatar_url),
          })
          .where(eq(user.id, Number(params.user.id)))
          .run();
      }

      return true;
    },
    async session(params) {
      return params.session;
    },
  },
  events: {
    // That should probably done in the callback method instead
    async createUser(params) {
      if (!params.user.id || !params.user.email) {
        throw new Error("User id & email is required");
      }

      // this means the user has already been created with clerk
      if (params.user.tenantId) return;

      await sendEmail({
        from: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        subject: "Level up your website and API monitoring.",
        to: [params.user.email],
        react: WelcomeEmail(),
      });

      const { id: userId, email } = params.user;

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
    signIn: "/app/login",
    // newUser: "/app/onboarding", // TODO: rethink this as we still have the `slug` to use
  },
  // basePath: "/api/auth", // default is `/api/auth`
  // secret: process.env.AUTH_SECRET, // default is `AUTH_SECRET`
});
