import { NextResponse } from "next/server";

import { db } from "@openstatus/db/src/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";

import { auth } from "@/lib/auth";
import { eq } from "@openstatus/db";
import { env } from "./env";

export const getValidSubdomain = (host?: string | null) => {
  let subdomain: string | null = null;
  if (!host && typeof window !== "undefined") {
    // On client side, get the host from window
    // biome-ignore lint: to fix later
    host = window.location.host;
  }
  // we should improve here for custom vercel deploy page
  if (host?.includes(".") && !host.includes(".vercel.app")) {
    const candidate = host.split(".")[0];
    if (candidate && !candidate.includes("www")) {
      // Valid candidate
      subdomain = candidate;
    }
  }
  if (host?.includes("ngrok-free.app")) {
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

const publicAppPaths = [
  "/app/sign-in",
  "/app/sign-up",
  "/app/login",
  "/app/invite",
  "/app/onboarding",
];

// remove auth middleware if needed
// export const middleware = () => NextResponse.next();

export default auth(async (req) => {
  const url = req.nextUrl.clone();

  if (url.pathname.includes("api/trpc")) {
    return NextResponse.next();
  }

  const host = req.headers.get("host");
  const subdomain = getValidSubdomain(host);

  // Rewriting to status page!
  if (subdomain) {
    url.pathname = `/status-page/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  const pathname = req.nextUrl.pathname;

  const isPublicAppPath = publicAppPaths.some((path) =>
    pathname.startsWith(path),
  );

  if (!req.auth && pathname.startsWith("/app/invite")) {
    return NextResponse.redirect(
      new URL(
        `/app/login?redirectTo=${encodeURIComponent(req.nextUrl.href)}`,
        req.url,
      ),
    );
  }

  if (!req.auth && pathname.startsWith("/app") && !isPublicAppPath) {
    return NextResponse.redirect(
      new URL(
        `/app/login?redirectTo=${encodeURIComponent(req.nextUrl.href)}`,
        req.url,
      ),
    );
  }

  if (req.auth?.user?.id) {
    if (pathname.startsWith("/app") && !isPublicAppPath) {
      const workspaceSlug = req.nextUrl.pathname.split("/")?.[2];
      const hasWorkspaceSlug = !!workspaceSlug && workspaceSlug.trim() !== "";

      const allowedWorkspaces = await db
        .select()
        .from(usersToWorkspaces)
        .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
        .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
        .where(eq(user.id, Number.parseInt(req.auth.user.id)))
        .all();

      if (hasWorkspaceSlug) {
        const hasAccessToWorkspace = allowedWorkspaces.find(
          ({ workspace }) => workspace.slug === workspaceSlug,
        );
        if (hasAccessToWorkspace) {
          const workspaceCookie = req.cookies.get("workspace-slug")?.value;
          const hasChanged = workspaceCookie !== workspaceSlug;
          if (hasChanged) {
            const response = NextResponse.redirect(url);
            response.cookies.set("workspace-slug", workspaceSlug);
            return response;
          }
        } else {
          return NextResponse.redirect(new URL("/app", req.url));
        }
      } else {
        if (allowedWorkspaces.length > 0) {
          const firstWorkspace = allowedWorkspaces[0].workspace;
          const { slug } = firstWorkspace;
          return NextResponse.redirect(
            new URL(`/app/${slug}/monitors`, req.url),
          );
        }
      }
    }
  }

  // reset workspace slug cookie if no auth
  if (!req.auth && req.cookies.has("workspace-slug")) {
    const response = NextResponse.next();
    response.cookies.delete("workspace-slug");
    return response;
  }
});

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    "/",
    "/(api/webhook|api/trpc)(.*)",
    "/(!api/checker/:path*|!api/og|!api/ping)",
  ],
  unstable_allowDynamic: [
    // use a glob to allow anything in the function-bind 3rd party module
    // "**/packages/analytics/src/**",
    // // "@jitsu/js/**",
    // "**/node_modules/@jitsu/**",
    // "**/node_modules/**/@jitsu/**",
    // "**/node_modules/@openstatus/analytics/**",
    // "@openstatus/analytics/**",
    // "@jitsu/js/dist/jitsu.es.js",
    // "**/analytics/src/**",
    // "**/node_modules/.pnpm/@jitsu/**",
    // "/node_modules/function-bind/**",
    // "**/node_modules/.pnpm/**/function-bind/**",
    // "../../packages/analytics/src/index.ts",
  ],
};
