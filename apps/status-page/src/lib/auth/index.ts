import type { DefaultSession } from "next-auth";
import NextAuth from "next-auth";

import { db, eq } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";

import { adapter } from "./adapter";
import { ResendProvider } from "./providers";

export type { DefaultSession };

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: process.env.NODE_ENV === "development",
  adapter,
  providers: [ResendProvider],
  callbacks: {
    async signIn(params) {
      console.log({ params });
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
    redirect: async (params) => {
      return params.url;
    },
    async session(params) {
      return params.session;
    },
  },
});
