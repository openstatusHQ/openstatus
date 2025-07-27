import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";

export default auth(async (req) => {
  const url = req.nextUrl.clone();
  const response = NextResponse.next();

  if (url.pathname.includes("api/trpc")) {
    return response;
  }

  if (!req.auth && url.pathname !== "/login") {
    const newURL = new URL("/login", req.url);
    const encodedSearchParams = `${url.pathname}${url.search}`;

    if (encodedSearchParams) {
      newURL.searchParams.append("redirectTo", encodedSearchParams);
    }

    return NextResponse.redirect(newURL);
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
