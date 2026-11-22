import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_DOMAIN,
  ATTRIBUTION_MAX_AGE,
  type Attribution,
  parseAttribution,
  serializeAttribution,
} from "@openstatus/analytics/src/attribution";
import { asc, db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";
import { getCurrency } from "@openstatus/db/src/schema/plan/utils";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  AUTH_REDIRECT_COOKIE,
  AUTH_REDIRECT_COOKIE_OPTIONS,
} from "@/lib/auth-redirect-cookie";
import { SSO_ORG_COOKIE } from "@/lib/sso-cookie";
import {
  WORKSPACE_SLUG_COOKIE,
  WORKSPACE_SLUG_MAX_AGE,
} from "@/lib/workspace-cookie";

const ATTRIBUTION_PARAMS = [
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
] as const;

function referrerHost(req: NextRequest): string | undefined {
  const referer = req.headers.get("referer");
  if (!referer) return undefined;
  try {
    const host = new URL(referer).hostname;
    const own = ATTRIBUTION_DOMAIN.slice(1);
    const internal =
      host === own ||
      host.endsWith(ATTRIBUTION_DOMAIN) ||
      host === req.nextUrl.hostname;
    return internal ? undefined : host;
  } catch {
    return undefined;
  }
}

// First touch for visitors who reach the app without passing through the web
// app (GitHub, docs, email, bookmarks). An existing cookie only gains a
// missing `ref`, since marketing CTAs land here as `?ref=home-hero` and the
// login redirect would drop it otherwise.
function withAttributionRef(
  req: NextRequest & { auth: unknown },
  response: NextResponse,
) {
  const raw = req.cookies.get(ATTRIBUTION_COOKIE)?.value;
  const ref = req.nextUrl.searchParams.get("ref");

  let next: Attribution;
  if (raw) {
    const current = parseAttribution(raw);
    if (!ref || current.ref) return response;
    next = { ...current, ref };
  } else {
    if (req.auth) return response;
    next = {
      landing_path: req.nextUrl.pathname,
      landing_referrer: referrerHost(req),
    };
    for (const key of ATTRIBUTION_PARAMS) {
      const value = req.nextUrl.searchParams.get(key);
      if (value) next[key] = value;
    }
  }

  const onProd = req.nextUrl.hostname.endsWith(ATTRIBUTION_DOMAIN.slice(1));
  response.cookies.set(ATTRIBUTION_COOKIE, serializeAttribution(next), {
    path: "/",
    maxAge: ATTRIBUTION_MAX_AGE,
    sameSite: "lax",
    secure: onProd,
    ...(onProd ? { domain: ATTRIBUTION_DOMAIN } : {}),
  });
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
      response.cookies.set(
        AUTH_REDIRECT_COOKIE,
        encodedSearchParams,
        AUTH_REDIRECT_COOKIE_OPTIONS,
      );
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
        res.cookies.delete(AUTH_REDIRECT_COOKIE);
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
      response.cookies.set(WORKSPACE_SLUG_COOKIE, query.workspace.slug, {
        path: "/",
        maxAge: WORKSPACE_SLUG_MAX_AGE,
        sameSite: "lax",
      });
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
    req.cookies.has(AUTH_REDIRECT_COOKIE)
  ) {
    response.cookies.delete(AUTH_REDIRECT_COOKIE);
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|icon.svg|sitemap.xml|robots.txt).*)",
  ],
};
