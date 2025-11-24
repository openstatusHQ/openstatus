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

  const subdomain = getValidSubdomain(url.host);
  console.log({
    hostnames,
    pathnames,
    host,
    urlHost: url.host,
    subdomain,
  });

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

  if (subdomain !== null) {
    prefix = subdomain.toLowerCase();
  }

  console.log({ pathname: url.pathname, type, prefix });

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
    const protectedCookie = cookies.get(createProtectedCookieKey(_page.slug));
    const cookiePassword = protectedCookie ? protectedCookie.value : undefined;
    const queryPassword = url.searchParams.get("pw");
    const password = queryPassword || cookiePassword;

    if (password !== _page.password && !url.pathname.endsWith("/protected")) {
      const { pathname, origin } = req.nextUrl;

      // custom domain redirect
      if (_page.customDomain && host !== `${_page.slug}.stpg.dev`) {
        const redirect = pathname.replace(`/${_page.customDomain}`, "");
        const url = new URL(
          `https://${
            _page.customDomain
          }/protected?redirect=${encodeURIComponent(redirect)}`,
        );
        console.log("redirect to /protected", url.toString());
        return NextResponse.redirect(url);
      }

      const url = new URL(
        `${origin}${
          type === "pathname" ? `/${prefix}` : ""
        }/protected?redirect=${encodeURIComponent(pathname)}`,
      );
      return NextResponse.redirect(url);
    }
    if (password === _page.password && url.pathname.endsWith("/protected")) {
      const redirect = url.searchParams.get("redirect");

      // custom domain redirect
      if (_page.customDomain && host !== `${_page.slug}.stpg.dev`) {
        const url = new URL(`https://${_page.customDomain}${redirect ?? "/"}`);
        console.log("redirect to /", url.toString());
        return NextResponse.redirect(url);
      }

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
    const rewriteUrl = new URL(`/${prefix}${url.pathname}`, req.url);
    // Preserve search params from original request
    rewriteUrl.search = url.search;
    return NextResponse.rewrite(rewriteUrl);
  }

  if (_page.customDomain && host !== `${_page.slug}.stpg.dev`) {
    if (pathnames.length > 2) {
      const pathname = pathnames.slice(2).join("/");
      const rewriteUrl = new URL(`/${_page.slug}/${pathname}`, req.url);
      rewriteUrl.search = url.search;
      return NextResponse.rewrite(rewriteUrl);
    }
    if(_page.customDomain && subdomain) {
      const rewriteUrl = new URL(`/${url.pathname}`, req.url);
      console.log({ rewriteUrl });
      rewriteUrl.search = url.search;
      return NextResponse.rewrite(rewriteUrl);
    }
    const rewriteUrl = new URL(`/${_page.slug}`, req.url);
    rewriteUrl.search = url.search;
    return NextResponse.rewrite(rewriteUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

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

  // In case the host is a custom domain
  if (host && !(host?.includes("stpg.dev") || host?.endsWith(".vercel.app"))) {
    subdomain = host;
  }
  return subdomain;
};
