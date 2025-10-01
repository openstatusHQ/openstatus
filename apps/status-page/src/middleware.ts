import { type NextRequest, NextResponse } from "next/server";

import { db, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { createProtectedCookieKey } from "./lib/protected";

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const response = NextResponse.next();
  const cookies = req.cookies;
  const headers = req.headers;
  const host = headers.get("x-forwarded-host");

  let prefix = "";
  let type: "hostname" | "pathname";

  const hostnames = host?.split(/[.:]/) ?? url.host.split(/[.:]/);
  const pathnames = url.pathname.split("/");

  console.log({ hostnames, pathnames, host, urlHost: url.host });

  if (
    hostnames.length > 2 &&
    hostnames[0] !== "www" &&
    !url.host.endsWith(".vercel.app")
  ) {
    prefix = hostnames[0].toLowerCase();
    type = "hostname";
  } else {
    prefix = pathnames[1].toLowerCase();
    type = "pathname";
  }

  console.log({ pathname: url.pathname, type });

  if (url.pathname === "/" && type !== "hostname") {
    return response;
  }

  const _page = await db
    .select()
    .from(page)
    .where(
      sql`lower(${page.slug}) = ${prefix} OR lower(${page.customDomain}) = ${prefix}`,
    )
    .get();

  console.log({ slug: _page?.slug, customDomain: _page?.customDomain });

  if (!_page) {
    // return NextResponse.redirect(new URL("https://stpg.dev"));
    // TODO: work on 404 page
    return response;
  }

  if (_page?.passwordProtected) {
    const protectedCookie = cookies.get(createProtectedCookieKey(prefix));
    const password = protectedCookie ? protectedCookie.value : undefined;
    if (password !== _page.password && !url.pathname.endsWith("/protected")) {
      const { pathname, origin } = req.nextUrl;
      const url = new URL(
        `${origin}${
          type === "pathname" ? `/${prefix}` : ""
        }/protected?redirect=${encodeURIComponent(pathname)}`,
      );
      return NextResponse.redirect(url);
    }
    if (password === _page.password && url.pathname.endsWith("/protected")) {
      const redirect = url.searchParams.get("redirect");
      return NextResponse.redirect(
        new URL(
          `${req.nextUrl.origin}${
            redirect ?? type === "pathname" ? `/${prefix}` : "/"
          }`,
        ),
      );
    }
  }

  const proxy = req.headers.get("x-proxy");
  console.log({ proxy });

  if (proxy) {
    return NextResponse.rewrite(new URL(`/${prefix}${url.pathname}`, req.url));
  }

  if(_page?.customDomain){
    return NextResponse.rewrite(new URL(`/${_page.slug}`, req.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
