import { NextResponse } from "next/server";
import { authMiddleware, redirectToSignIn } from "@clerk/nextjs";

import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces } from "@openstatus/db/src/schema";

export default authMiddleware({
  publicRoutes: [
    "/",
    "/play",
    "/play/(.*)",
    "/monitor/(.*)",
    "/api/(.*)",
    "/api/og",
    "/api/ping",
    "/api/v0/cron",
    "/api/v0/ping",
    "/api/webhook/clerk",
    "/api/checker/regions/(.*)",
    "/api/checker/cron/10m",
  ],
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
        .run();

      if (result.rows.length > 0) {
        const orgSelection = new URL(
          `/app/${result[0].users_to_workspaces.workspaceId}`,
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
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
