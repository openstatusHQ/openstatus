import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { DefaultSession } from "next-auth";
import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import * as randomWordSlugs from "random-word-slugs";

import { analytics, trackAnalytics } from "@openstatus/analytics";
// import Credentials from "next-auth/providers/credentials";

import { db, eq } from "@openstatus/db";
import {
  account,
  session,
  user,
  usersToWorkspaces,
  verificationToken,
  workspace,
} from "@openstatus/db/src/schema";
import { sendEmail, WelcomeEmail } from "@openstatus/emails";

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
  // @ts-expect-error
  createUser: async (data) => {
    const { id, ...rest } = data;
    const newUser = await db
      .insert(user)
      .values({ email: rest.email, photoUrl: rest.image, name: rest.name })
      .returning({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      })
      .get();

    let slug: string | undefined = undefined;

    while (!slug) {
      slug = randomWordSlugs.generateSlug(2);
      const slugAlreadyExists = await db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, slug))
        .get();
      if (slugAlreadyExists) {
        console.log(`slug already exists: '${slug}'`);
        slug = undefined;
      }
    }

    const workspaceResult = await db
      .insert(workspace)
      .values({ slug, name: "" })
      .returning({ id: workspace.id })
      .get();
    await db
      .insert(usersToWorkspaces)
      .values({
        userId: Number(newUser.id),
        workspaceId: workspaceResult.id,
        role: "owner",
      })
      .returning()
      .get();
    return newUser;
  },
  // @ts-expect-error
  getUser: async (id) => {
    return db
      .select({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
      })
      .from(user)
      .where(eq(user.id, Number(id)))
      .get();
  },
};

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
    // async session(params) {
    //   return;
    // },
    async signIn(params) {
      // we update the user info when we login

      if (params.account?.provider === "google") {
        if (!params.profile) {
          return true;
        }

        if (Number.isNaN(Number(params.user.id))) {
          return true;
        }
        const { given_name, family_name, picture } = params.profile;
        await db
          .update(user)
          .set({
            firstName: given_name,
            lastName: family_name,
            photoUrl: picture,
          })
          .where(eq(user.id, Number(params.user.id)))
          .run();
      }
      if (params.account?.provider === "github") {
        if (!params.profile) {
          return true;
        }
        if (Number.isNaN(Number(params.user.id))) {
          return true;
        }

        //  GitHub store  the avatar in avatar_url
        const photoUrl = String(params.profile.avatar_url);
        const { name } = params.profile;
        await db
          .update(user)
          .set({
            name,
            photoUrl,
          })
          .where(eq(user.id, Number(params.user.id)))
          .run();
      }

      return true;
    },
    session: (params) => {
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
      if (params.user.tenantId) {
        return;
      }

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
