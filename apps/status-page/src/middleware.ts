import { type NextRequest, NextResponse } from "next/server";

import { db, eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { createProtectedCookieKey } from "./lib/protected";

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const response = NextResponse.next();
  const cookies = req.cookies;

  let prefix = "";

  const hostnames = url.host.split(".");
  const pathnames = url.pathname.split("/");
  if (hostnames.length > 2 && hostnames[0] !== "www") {
    prefix = hostnames[0].toLowerCase();
  } else {
    prefix = pathnames[1].toLowerCase();
  }

  const _page = await db.select().from(page).where(eq(page.slug, prefix)).get();

  if (!_page) {
    return NextResponse.redirect(new URL("https://openstatus.dev"));
  }

  if (_page?.passwordProtected) {
    const protectedCookie = cookies.get(createProtectedCookieKey(prefix));
    const password = protectedCookie ? protectedCookie.value : undefined;
    if (password !== _page.password) {
      return NextResponse.redirect(new URL("https://openstatus.dev"));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
