import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";
import { getCurrency } from "@openstatus/db/src/schema/plan/utils";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { WORKSPACE_SLUG_COOKIE } from "@/lib/workspace-cookie";

export default auth(async (req) => {
  const url = req.nextUrl.clone();
  const response = NextResponse.next();

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

    const response = NextResponse.redirect(newURL);
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

  if (req.auth?.user?.id && !hasWorkspaceSlug) {
    const [query] = await db
      .select()
      .from(usersToWorkspaces)
      .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
      .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
      .where(eq(user.id, Number.parseInt(req.auth.user.id)))
      .all();

    if (!query) {
      console.error(">> Should not happen, no workspace found for user");
    }

    response.cookies.set(WORKSPACE_SLUG_COOKIE, query.workspace.slug);
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
    "/((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
