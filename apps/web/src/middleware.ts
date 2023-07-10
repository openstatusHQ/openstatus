import { NextResponse } from "next/server";
import { authMiddleware, redirectToSignIn } from "@clerk/nextjs";

import { createTRPCContext } from "@openstatus/api";
import { edgeRouter } from "@openstatus/api/src/edge";
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
    if (auth.userId && req.nextUrl.pathname === "/app") {
      const userQuery = db
        .select()
        .from(user)
        .where(eq(user.tenantId, auth.userId))
        .as("userQuery");
      const result = await db
        .select()
        .from(usersToWorkspaces)
        .leftJoin(userQuery, eq(userQuery.id, usersToWorkspaces.userId))
        .execute();
      if (result.length) {
        const orgSelection = new URL(
          `/app/${result[0].users_to_workspaces.workspaceId}`,
          req.url,
        );
        return NextResponse.redirect(orgSelection);
      }
    }
  },
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
