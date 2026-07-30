import { db, eq } from "@openstatus/db";
import { viewer } from "@openstatus/db/src/schema";
import type { DefaultSession } from "next-auth";
import NextAuth from "next-auth";
import { headers } from "next/headers";

import { getPageSlugHeader } from "../page-slug";
import { getQueryClient, trpc } from "../trpc/server";
import { adapter } from "./adapter";
import { ResendProvider } from "./providers";

export type { DefaultSession };

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: process.env.NODE_ENV === "development",
  adapter,
  providers: [ResendProvider],
  callbacks: {
    async signIn(params) {
      if (!params.user.email) return false;

      // Absent on the /api/auth/callback leg, which the proxy matcher excludes.
      // Skipping the check there is safe: the token was only issued once it
      // passed, and the proxy re-gates every page view against its own domains.
      const slug = getPageSlugHeader(await headers());

      if (slug) {
        const queryClient = getQueryClient();
        // NOTE: throws an error if the email domain is not allowed
        const query = await queryClient.fetchQuery(
          trpc.statusPage.validateEmailDomain.queryOptions({
            slug,
            email: params.user.email,
          }),
        );

        if (!query) return false;
      }

      if (params.account?.provider === "resend") {
        // if the user is new, the id is the verification_token and not the viewer id, so we cannot update the viewer
        if (Number.isNaN(Number(params.user.id))) return true;
        await db
          .update(viewer)
          .set({ updatedAt: new Date() })
          .where(eq(viewer.id, Number(params.user.id)))
          .run();

        return true;
      }

      return false;
    },
    redirect: async (params) => {
      return params.url;
    },
    async session(params) {
      return params.session;
    },
  },
});
