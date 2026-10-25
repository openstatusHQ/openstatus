import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_DOMAIN,
  ATTRIBUTION_MAX_AGE,
  parseAttribution,
  serializeAttribution,
} from "@openstatus/analytics/src/attribution";
import { asc, db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";
import { getCurrency } from "@openstatus/db/src/schema/plan/utils";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { SSO_ORG_COOKIE } from "@/lib/sso-cookie";
import { WORKSPACE_SLUG_COOKIE } from "@/lib/workspace-cookie";

// Marketing CTAs land here as `?ref=home-hero`. Fold the ref into the
// first-touch cookie the web app set (or start one) so `user_created` can
// carry it; the ref is dropped by the login redirect otherwise.
function withAttributionRef(req: NextRequest, response: NextResponse) {
  const ref = req.nextUrl.searchParams.get("ref");
  if (!ref) return response;
  const current = parseAttribution(req.cookies.get(ATTRIBUTION_COOKIE)?.value);
  if (current.ref) return response;
  const onProd = req.nextUrl.hostname.endsWith(ATTRIBUTION_DOMAIN.slice(1));
  response.cookies.set(
    ATTRIBUTION_COOKIE,
    serializeAttribution({ ...current, ref }),
    {
      path: "/",
      maxAge: ATTRIBUTION_MAX_AGE,
      sameSite: "lax",
      secure: onProd,
      ...(onProd ? { domain: ATTRIBUTION_DOMAIN } : {}),
    },
  );
  return response;
}

export default auth(async (req) => {
  const url = req.nextUrl.clone();
  const response = withAttributionRef(req, NextResponse.next());

  const continent = req.headers.get("x-vercel-ip-continent") || "NA";
  const country = req.headers.get("x-vercel-ip-country") || "US";
  const currency = getCurrency({ continent, country });

  // NOTE: used in the pricing table to display the currency based on user's location
  response.cookies.set("x-currency", currency);

  if (url.pathname.includes("api/trpc")) {
    return response;
  }

  if (!req.auth && url.pathname !== "/login") {
    if (process.env.NODE_ENV === "development") {
      console.log("User not authenticated, redirecting to login");
    }
    const newURL = new URL("/login", req.url);
    // Only worth preserving a non-root destination; tryRedirectToCallback
    // rejects "/" anyway, so storing it would be a no-op redirect.
    const encodedSearchParams =
      url.pathname === "/" ? null : `${url.pathname}${url.search}`;

    if (encodedSearchParams) {
      newURL.searchParams.append("redirectTo", encodedSearchParams);
    }

    const response = withAttributionRef(req, NextResponse.redirect(newURL));
    // Store the redirect URL in a cookie for new users who go through onboarding.
    // Auth.js may not reliably pass callbackUrl to pages.newUser, so we use a
    // cookie as a fallback to ensure invite links work correctly.
    if (encodedSearchParams) {
      response.cookies.set("auth-redirect", encodedSearchParams, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 10, // 10 minutes
      });
    }
    return response;
  }

  if (req.auth && url.pathname === "/login") {
    const redirectTo = url.searchParams.get("redirectTo");
    if (redirectTo) {
      // Same-origin only: rebuild from path/search/hash so an absolute
      // redirectTo (e.g. https://evil.com) can't become an open redirect.
      const target = new URL(redirectTo, req.nextUrl.origin);
      if (
        (target.protocol === "http:" || target.protocol === "https:") &&
        !target.pathname.startsWith("//")
      ) {
        const safe = new URL(
          `${target.pathname}${target.search}${target.hash}`,
          req.nextUrl.origin,
        );
        if (process.env.NODE_ENV === "development") {
          console.log("User authenticated, redirecting to", safe);
        }
        const res = NextResponse.redirect(safe);
        res.cookies.delete("auth-redirect");
        return res;
      }
    }
  }

  const hasWorkspaceSlug = req.cookies.has(WORKSPACE_SLUG_COOKIE);
  const ssoOrg = req.cookies.get(SSO_ORG_COOKIE)?.value;

  if (req.auth?.user?.id && (!hasWorkspaceSlug || ssoOrg)) {
    const rows = await db
      .select()
      .from(usersToWorkspaces)
      .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
      .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
      .where(eq(user.id, Number.parseInt(req.auth.user.id)))
      .orderBy(asc(usersToWorkspaces.createdAt))
      .all();

    // The cookie only *selects* among workspaces the user already belongs to —
    // it can never grant access, so a forged value is inert.
    const target = ssoOrg
      ? rows.find((row) => row.workspace.workosOrganizationId === ssoOrg)
      : undefined;
    const query = target ?? rows[0];

    if (!query) {
      console.error(">> Should not happen, no workspace found for user");
    } else if (target || !hasWorkspaceSlug) {
      response.cookies.set(WORKSPACE_SLUG_COOKIE, query.workspace.slug);
    }
  }

  if (ssoOrg) {
    response.cookies.delete(SSO_ORG_COOKIE);
  }

  if (!req.auth && hasWorkspaceSlug) {
    response.cookies.delete(WORKSPACE_SLUG_COOKIE);
  }

  // auth-redirect is single-use and consumed by the /onboarding Server
  // Component. Middleware response-cookie writes are reflected into the same
  // request's cookies(), so deleting it on the /onboarding request itself
  // would race (and lose) that read. Clear it on the next authenticated
  // request instead: by then onboarding has redirected to the target, the
  // cookie's job is done, and the stale back-button re-redirect is killed.
  if (
    req.auth &&
    url.pathname !== "/onboarding" &&
    req.cookies.has("auth-redirect")
  ) {
    response.cookies.delete("auth-redirect");
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|icon.svg|sitemap.xml|robots.txt).*)",
  ],
};
