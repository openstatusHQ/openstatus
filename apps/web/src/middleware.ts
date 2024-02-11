import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authMiddleware, redirectToSignIn } from "@clerk/nextjs";

import { db, eq } from "@openstatus/db";
import {
  monitor,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";

import { env } from "./env";

const before = (req: NextRequest) => {
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
  if (host && host.includes("ngrok-free.app")) {
    return null;
  }
  // In case the host is a custom domain
  if (
    host &&
    !(host?.includes(env.NEXT_PUBLIC_URL) || host?.endsWith(".vercel.app"))
  ) {
    subdomain = host;
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
    "/status",
    "/status/(.*)",
    "/changelog",
    "/changelog/(.*)",
    "/legal/(.*)",
    "/about",
    "/cal",
    "/discord",
    "/github",
    "/pricing",
    "/oss-friends",
    "/status-page/(.*)",
    "/incidents", // used when trying subdomain slug via status.documenso.com/incidents
    "/incidents/(.*)", // used when trying subdomain slug via status.documenso.com/incidents/123
    "/verify/(.*)", // used when trying subdomain slug via status.documenso.com/incidents
  ],
  ignoredRoutes: ["/api/og", "/discord", "/github", "/status-page/(.*)"], // FIXME: we should check the `publicRoutes`
  beforeAuth: before,
  debug: false,
  async afterAuth(auth, req) {
    // handle users who aren't authenticated
    if (!auth.userId && !auth.isPublicRoute) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }

    if (auth.userId) {
      console.log(">>> Authenticated", auth.userId);
      const pathname = req.nextUrl.pathname;
      if (pathname.startsWith("/app") && !pathname.startsWith("/app/invite")) {
        const workspaceSlug = req.nextUrl.pathname.split("/")?.[2];
        const hasWorkspaceSlug = !!workspaceSlug && workspaceSlug.trim() !== "";

        const allowedWorkspaces = await db
          .select()
          .from(usersToWorkspaces)
          .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
          .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
          .where(eq(user.tenantId, auth.userId))
          .all();

        // means, we are "not only on `/app` or `/app/`"
        if (hasWorkspaceSlug) {
          console.log(">>> Workspace slug", workspaceSlug);
          const hasAccessToWorkspace = allowedWorkspaces.find(
            ({ workspace }) => workspace.slug === workspaceSlug,
          );
          if (hasAccessToWorkspace) {
            console.log(">>> Allowed! Attaching to cookie", workspaceSlug);
            req.cookies.set("workspace-slug", workspaceSlug);
          } else {
            console.log(">>> Not allowed, redirecting to /app", workspaceSlug);
            const appURL = new URL("/app", req.url);
            return NextResponse.redirect(appURL);
          }
        } else {
          console.log(">>> No workspace slug available");
          if (allowedWorkspaces.length > 0) {
            const firstWorkspace = allowedWorkspaces[0].workspace;
            const { id, slug } = firstWorkspace;
            console.log(">>> Redirecting to first related workspace", slug);
            const firstMonitor = await db
              .select()
              .from(monitor)
              .where(eq(monitor.workspaceId, firstWorkspace.id))
              .get();

            if (!firstMonitor) {
              console.log(`>>> Redirecting to onboarding`, slug);
              const onboardingURL = new URL(`/app/${slug}/onboarding`, req.url);
              return NextResponse.redirect(onboardingURL);
            }

            console.log(">>> Redirecting to workspace", slug);
            const monitorURL = new URL(`/app/${slug}/monitors`, req.url);
            return NextResponse.redirect(monitorURL);
          }
          console.log(">>> No action taken");
        }
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
