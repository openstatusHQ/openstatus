import { Events, setupAnalytics } from "@openstatus/analytics";
import { db, eq } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";
import { WelcomeEmail, sendEmail } from "@openstatus/emails";
import type { DefaultSession } from "next-auth";
import NextAuth from "next-auth";
import { headers } from "next/headers";
import { cache } from "react";

import { adapter } from "./adapter";
import { logger } from "./logger";
import {
  GitHubProvider,
  GoogleProvider,
  OIDCProvider,
  ResendProvider,
  WorkOSProvider,
} from "./providers";
import {
  authorizeSsoSignIn,
  joinWorkspaceViaSso,
  readWorkOSProfile,
} from "./sso";

const hasWorkOS = Boolean(
  process.env.AUTH_WORKOS_ID && process.env.AUTH_WORKOS_SECRET,
);

export type { DefaultSession };

async function syncUser(
  userId: number,
  fields: {
    firstName?: string | null;
    lastName?: string | null;
    photoUrl?: string | null;
    name?: string | null;
  },
) {
  await db
    .update(user)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .run();
}

const {
  handlers,
  signIn,
  signOut,
  auth: nextAuth,
} = NextAuth({
  // debug: true,
  adapter,
  logger,
  providers: [
    GitHubProvider,
    GoogleProvider,
    ...(process.env.AUTH_OIDC_ISSUER ? [OIDCProvider] : []),
    ...(hasWorkOS ? [WorkOSProvider] : []),
    ...(process.env.NODE_ENV === "development" ||
    process.env.SELF_HOST === "true"
      ? [ResendProvider]
      : []),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Allow relative URLs, but not protocol-relative `//evil.com` which the
      // browser would resolve off-origin.
      if (url.startsWith("/") && !url.startsWith("//")) {
        return `${baseUrl}${url}`;
      }
      // Same-origin absolute URLs only — compare parsed origins, not a string
      // prefix, so `https://<baseUrl>.evil.com` cannot pass as trusted.
      // Preserves the original callback URL so invite links keep working.
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) {
          return url;
        }
      } catch {
        // malformed url — fall through to baseUrl
      }
      return baseUrl;
    },
    async signIn(params) {
      // We keep updating the user info when we loggin in

      if (params.account?.provider === "google") {
        if (!params.profile) return true;
        if (Number.isNaN(Number(params.user.id))) return true;

        await syncUser(Number(params.user.id), {
          firstName: params.profile.given_name,
          lastName: params.profile.family_name || "",
          photoUrl: params.profile.picture,
          // keep the name in sync
          name: `${params.profile.given_name} ${
            params.profile.family_name || ""
          }`.trim(),
        });
      }
      if (params.account?.provider === "github") {
        if (!params.profile) return true;
        if (Number.isNaN(Number(params.user.id))) return true;

        await syncUser(Number(params.user.id), {
          name: params.profile.name,
          photoUrl: String(params.profile.avatar_url),
        });
      }

      if (params.account?.provider === "oidc") {
        if (!params.profile) return true;
        if (Number.isNaN(Number(params.user.id))) return true;

        const { given_name, family_name, name, picture } = params.profile;
        // some IdPs only send a combined `name` claim
        const [nameFirst, ...nameRest] = name?.split(" ") ?? [];
        const fullName = [given_name, family_name].filter(Boolean).join(" ");

        await syncUser(Number(params.user.id), {
          firstName: given_name ?? nameFirst,
          lastName: family_name || nameRest.join(" "),
          photoUrl: picture,
          name: fullName || name,
        });
      }

      if (params.account?.provider === "workos") {
        return authorizeSsoSignIn(readWorkOSProfile(params.profile));
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
        from: "Thibault from OpenStatus <thibault@openstatus.dev>",
        subject: "Welcome to OpenStatus.",
        to: [params.user.email],
        react: WelcomeEmail(),
      });

      const analytics = await setupAnalytics({
        userId: `usr_${params.user.id}`,
        email: params.user.email,
        location: (await headers()).get("x-forwarded-for") ?? undefined,
        userAgent: (await headers()).get("user-agent") ?? undefined,
      });

      await analytics.track(Events.CreateUser);
    },

    async signIn(params) {
      if (params.account?.provider === "workos") {
        const { organization_id: organizationId } = readWorkOSProfile(
          params.profile,
        );
        const userId = Number(params.user.id);
        if (organizationId && !Number.isNaN(userId)) {
          await joinWorkspaceViaSso({ organizationId, userId });
        }
      }

      if (params.isNewUser) return;
      if (!params.user.id || !params.user.email) return;

      const analytics = await setupAnalytics({
        userId: `usr_${params.user.id}`,
        email: params.user.email,
        location: (await headers()).get("x-forwarded-for") ?? undefined,
        userAgent: (await headers()).get("user-agent") ?? undefined,
      });

      await analytics.track(Events.SignInUser);
    },
  },
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },
  // basePath: "/api/auth", // default is `/api/auth`
  // secret: process.env.AUTH_SECRET, // default is `AUTH_SECRET`
  debug: process.env.NODE_ENV === "development",
});

// The root layout and the tRPC RSC context both need the session; `cache`
// collapses them into a single lookup per render. Outside a React render
// (the proxy's `auth(handler)` form, route handlers) it is a pass-through.
export const auth = cache(nextAuth);
export { handlers, signIn, signOut };
