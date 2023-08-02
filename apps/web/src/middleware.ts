import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authMiddleware, redirectToSignIn } from "@clerk/nextjs";

import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";

const before = (req: NextRequest, ev: NextFetchEvent) => {
  const url = req.nextUrl.clone();

  if (url.pathname.includes("api/trpc")) {
    return NextResponse.next();
  }

  const host = req.headers.get("host");
  const subdomain = getValidSubdomain(host);
  if (subdomain) {
    // Subdomain available, rewriting
    console.log(
      `>>> Rewriting: ${url.pathname} to /status-page/${subdomain}${url.pathname}`,
    );
    url.pathname = `/status-page/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
};

export const getValidSubdomain = (host?: string | null) => {
  let subdomain: string | null = null;
  if (!host && typeof window !== "undefined") {
    // On client side, get the host from window
    host = window.location.host;
  }
  // we should improve here for custom vercel deploy page
  if (host && host.includes(".") && !host.includes(".vercel.app")) {
    const candidate = host.split(".")[0];
    if (candidate && !candidate.includes("www")) {
      // Valid candidate
      subdomain = candidate;
    }
  }
  return subdomain;
};

export default authMiddleware({
  publicRoutes: [
    "/",
    "/play",
    "/play/(.*)",
    "/monitor/(.*)",
    "/api/(.*)",
    "/api/webhook/clerk",
    "/api/checker/regions/(.*)",
    "/api/checker/cron/10m",
    "/blog",
    "/blog/(.*)",
    "/discord",
    "/github",
  ],
  ignoredRoutes: ["/api/og", "/discord", "github"], // FIXME: we should check the `publicRoutes`
  beforeAuth: before,
  async afterAuth(auth, req, evt) {
    // handle users who aren't authenticated
    if (!auth.userId && !auth.isPublicRoute) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }

    // redirect them to organization selection page
    if (
      auth.userId &&
      (req.nextUrl.pathname === "/app" || req.nextUrl.pathname === "/app/")
    ) {
      // improve on sign-up if the webhook has not been triggered yet
      const userQuery = db
        .select()
        .from(user)
        .where(eq(user.tenantId, auth.userId))
        .as("userQuery");
      const result = await db
        .select()
        .from(usersToWorkspaces)
        .innerJoin(userQuery, eq(userQuery.id, usersToWorkspaces.userId))
        .all();
      if (result.length > 0) {
        const currentWorkspace = await db
          .select()
          .from(workspace)
          .where(eq(workspace.id, result[0].users_to_workspaces.workspaceId))
          .get();
        const orgSelection = new URL(
          `/app/${currentWorkspace.slug}/monitors`,
          req.url,
        );
        return NextResponse.redirect(orgSelection);
      } else {
        // return NextResponse.redirect(new URL("/app/onboarding", req.url));
        // probably redirect to onboarding
        // or find a way to wait for the webhook
      }
    }
  },
});

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    "/",
    "/(api/webhook|api/trpc)(.*)",
    "/(!api/checker/:path*|!api/og|!api/ping)",
  ],
};
