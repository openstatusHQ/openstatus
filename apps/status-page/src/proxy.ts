import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

import { db, sql } from "@openstatus/db";
import { page, selectPageSchema } from "@openstatus/db/src/schema";
import { getValidSubdomain } from "./lib/domain";
import { createProtectedCookieKey } from "./lib/protected";
import { resolveRoute } from "./lib/resolve-route";

export default auth(async (req) => {
  const url = req.nextUrl.clone();
  const response = NextResponse.next();
  const cookies = req.cookies;
  const headers = req.headers;
  const host = headers.get("x-forwarded-host");

  const route = resolveRoute({
    host,
    urlHost: url.host,
    pathname: url.pathname,
  });

  if (!route) {
    return response;
  }

  const { type, prefix } = route;

  const query = await db
    .select()
    .from(page)
    .where(
      sql`lower(${page.slug}) = ${prefix} OR lower(${page.customDomain}) = ${prefix}`,
    )
    .get();

  const validation = selectPageSchema.safeParse(query);

  if (!validation.success) {
    return response;
  }

  const _page = validation.data;

  // Override locale with the page's default when no explicit locale was in the URL
  if (
    !route.localeExplicit &&
    _page.defaultLocale &&
    _page.defaultLocale !== route.locale
  ) {
    const oldLocale = route.locale;
    route.locale = _page.defaultLocale;
    route.rewritePath = route.rewritePath.replace(
      `/${route.prefix}/${oldLocale}`,
      `/${route.prefix}/${_page.defaultLocale}`,
    );
  }

  // Reject locales not in the page's allowed list — redirect to the page's default locale
  if (
    _page.locales &&
    _page.locales.length > 0 &&
    !_page.locales.includes(route.locale)
  ) {
    const pageDefault = _page.defaultLocale || "en";
    const redirectPath = route.rewritePath.replace(
      `/${route.prefix}/${route.locale}`,
      `/${route.prefix}/${pageDefault}`,
    );
    // For pathname routing, redirect to the rewrite path directly;
    // for hostname routing, strip the prefix from the redirect URL
    const externalPath =
      route.type === "hostname"
        ? redirectPath.replace(`/${route.prefix}`, "")
        : redirectPath;
    return NextResponse.redirect(new URL(externalPath || "/", req.url));
  }

  console.log({ slug: _page?.slug, customDomain: _page?.customDomain });

  if (_page?.accessType === "password") {
    const protectedCookie = cookies.get(createProtectedCookieKey(_page.slug));
    const cookiePassword = protectedCookie ? protectedCookie.value : undefined;
    const queryPassword = url.searchParams.get("pw");
    const password = queryPassword || cookiePassword;

    if (password !== _page.password && !url.pathname.endsWith("/login")) {
      const { pathname, origin } = req.nextUrl;

      // custom domain redirect
      if (_page.customDomain && host !== `${_page.slug}.stpg.dev`) {
        const redirect = pathname.replace(`/${_page.customDomain}`, "");
        const url = new URL(
          `https://${_page.customDomain}/login?redirect=${encodeURIComponent(
            redirect,
          )}`,
        );
        console.log("redirect to /login", url.toString());
        return NextResponse.redirect(url);
      }

      const url = new URL(
        `${origin}${
          type === "pathname" ? `/${prefix}` : ""
        }/login?redirect=${encodeURIComponent(pathname)}`,
      );
      return NextResponse.redirect(url);
    }
    if (password === _page.password && url.pathname.endsWith("/login")) {
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

  if (_page.accessType === "email-domain") {
    const { origin, pathname } = req.nextUrl;
    const email = req.auth?.user?.email;
    const emailDomain = email?.split("@")[1];
    if (
      !pathname.endsWith("/login") &&
      (!emailDomain || !_page.authEmailDomains.includes(emailDomain))
    ) {
      const url = new URL(
        `${origin}${type === "pathname" ? `/${prefix}` : ""}/login`,
      );
      return NextResponse.redirect(url);
    }
    if (
      pathname.endsWith("/login") &&
      emailDomain &&
      _page.authEmailDomains.includes(emailDomain)
    ) {
      const url = new URL(
        `${origin}${type === "pathname" ? `/${prefix}` : ""}`,
      );
      return NextResponse.redirect(url);
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

  console.log({
    customDomain: _page.customDomain,
    host,
    expectedHost: `${_page.slug}.stpg.dev`,
  });

  if (_page.customDomain && host !== `${_page.slug}.stpg.dev`) {
    const pathnames = url.pathname.split("/");
    const subdomain = getValidSubdomain(url.host);
    if (pathnames.length > 2 && !subdomain) {
      const pathname = pathnames.slice(2).join("/");
      const rewriteUrl = new URL(`/${_page.slug}/${pathname}`, req.url);
      rewriteUrl.search = url.search;
      return NextResponse.rewrite(rewriteUrl);
    }
    if (_page.customDomain && subdomain) {
      console.log({ url: req.url });
      if (pathnames.length > 2) {
        const pathname = pathnames.slice(1).join("/");
        const rewriteUrl = new URL(
          `${pathname}`,
          `https://${_page.slug}.stpg.dev`,
        );
        rewriteUrl.search = url.search;
        return NextResponse.rewrite(rewriteUrl);
      }
      const rewriteUrl = new URL(
        `${url.pathname}`,
        `https://${_page.slug}.stpg.dev`,
      );
      rewriteUrl.search = url.search;
      return NextResponse.rewrite(rewriteUrl);
    }
    const rewriteUrl = new URL(`/${_page.slug}`, req.url);
    rewriteUrl.search = url.search;
    return NextResponse.rewrite(rewriteUrl);
  }
  if (host?.includes("openstatus.dev")) {
    const rewriteUrl = new URL(route.rewritePath, req.url);
    // Preserve search params from original request
    rewriteUrl.search = url.search;
    return NextResponse.rewrite(rewriteUrl);
  }

  // Rewrite to the resolved path when it differs from the incoming pathname
  // (e.g. hostname routing or pathname routing without a locale segment)
  if (route.rewritePath !== url.pathname) {
    const rewriteUrl = new URL(route.rewritePath, req.url);
    rewriteUrl.search = url.search;
    return NextResponse.rewrite(rewriteUrl);
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
