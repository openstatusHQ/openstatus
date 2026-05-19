import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";
import { getCurrency } from "@openstatus/db/src/schema/plan/utils";

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
    console.log("User not authenticated, redirecting to login");
    const newURL = new URL("/login", req.url);
    const encodedSearchParams = `${url.pathname}${url.search}`;

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
        console.log("User authenticated, redirecting to", safe);
        return NextResponse.redirect(safe);
      }
    }
  }

  const hasWorkspaceSlug = req.cookies.has("workspace-slug");

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

    response.cookies.set("workspace-slug", query.workspace.slug);
  }

  if (!req.auth && hasWorkspaceSlug) {
    response.cookies.delete("workspace-slug");
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
