import { db, eq } from "@openstatus/db";
import { page, viewer } from "@openstatus/db/src/schema";
import type { DefaultSession } from "next-auth";
import NextAuth, { AuthError } from "next-auth";
import { headers } from "next/headers";

import { getValidCustomDomain } from "../domain";
import { getQueryClient, trpc } from "../trpc/server";
import { adapter } from "./adapter";
import { ResendProvider } from "./providers";

export type { DefaultSession };

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: process.env.NODE_ENV === "development",
  adapter,
  providers: [ResendProvider],
  callbacks: {
    async authorized({ auth, request }) {
      // Extract the page slug from the request
      const { prefix } = getValidCustomDomain(request);

      if (!prefix) {
        // No valid slug found, allow through to let routing handle it
        return true;
      }

      // Query the database to check if the page requires authentication
      const pageData = await db.query.page.findFirst({
        where: eq(page.slug, prefix),
        columns: {
          accessType: true,
        },
      });

      if (!pageData) {
        // Page not found, allow through to let routing handle 404
        return true;
      }

      // Allow access if the page is public OR if the user is authenticated
      return pageData.accessType === "public" || !!auth;
    },
    async signIn(params) {
      const _headers = await headers();
      const host = _headers.get("host");

      if (!host) throw new AuthError("No host found");

      const protocol = _headers.get("x-forwarded-proto") || "https";
      const req = new Request(`${protocol}://${host}`, {
        headers: new Headers(_headers),
      });
      const { prefix } = getValidCustomDomain(req);

      if (!prefix || !params.user.email) return false;

      const queryClient = getQueryClient();
      // NOTE: throws an error if the email domain is not allowed
      const query = await queryClient.fetchQuery(
        trpc.statusPage.validateEmailDomain.queryOptions({
          slug: prefix,
          email: params.user.email,
        }),
      );

      if (!query) return false;

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
