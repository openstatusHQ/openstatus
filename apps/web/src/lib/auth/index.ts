import type { DefaultSession } from "next-auth";
import NextAuth from "next-auth";

import { Events, setupAnalytics } from "@openstatus/analytics";
import { db, eq } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";

import { WelcomeEmail, sendEmail } from "@openstatus/emails";
import { adapter } from "./adapter";
import { GitHubProvider, GoogleProvider, ResendProvider } from "./providers";

export type { DefaultSession };

export const { handlers, signIn, signOut, auth } = NextAuth({
  // debug: true,
  adapter,
  providers:
    process.env.NODE_ENV === "development"
      ? [GitHubProvider, GoogleProvider, ResendProvider]
      : [GitHubProvider, GoogleProvider],
  callbacks: {
    async signIn(params) {
      // We keep updating the user info when we loggin in

      if (params.account?.provider === "google") {
        if (!params.profile) return true;
        if (Number.isNaN(Number(params.user.id))) return true;

        await db
          .update(user)
          .set({
            firstName: params.profile.given_name,
            lastName: params.profile.family_name,
            photoUrl: params.profile.picture,
            // keep the name in sync
            name: `${params.profile.given_name} ${params.profile.family_name}`,
            updatedAt: new Date(),
          })
          .where(eq(user.id, Number(params.user.id)))
          .run();
      }
      if (params.account?.provider === "github") {
        if (!params.profile) return true;
        if (Number.isNaN(Number(params.user.id))) return true;

        await db
          .update(user)
          .set({
            name: params.profile.name,
            photoUrl: String(params.profile.avatar_url),
            updatedAt: new Date(),
          })
          .where(eq(user.id, Number(params.user.id)))
          .run();
      }

      // REMINDER: only used in dev mode
      if (params.account?.provider === "resend") {
        if (Number.isNaN(Number(params.user.id))) return true;
        await db
          .update(user)
          .set({ updatedAt: new Date() })
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
        subject: "Welcome to OpenStatus.",
        to: [params.user.email],
        react: WelcomeEmail(),
      });

      const analytics = await setupAnalytics({
        userId: `usr_${params.user.id}`,
        email: params.user.email,
      });

      await analytics.track(Events.CreateUser);
    },

    async signIn(params) {
      if (params.isNewUser) return;
      if (!params.user.id || !params.user.email) return;

      const analytics = await setupAnalytics({
        userId: `usr_${params.user.id}`,
        email: params.user.email,
      });

      await analytics.track(Events.SignInUser);
    },
  },
  pages: {
    signIn: "/app/login",
    newUser: "/app/onboarding",
  },
  // basePath: "/api/auth", // default is `/api/auth`
  // secret: process.env.AUTH_SECRET, // default is `AUTH_SECRET`
});
