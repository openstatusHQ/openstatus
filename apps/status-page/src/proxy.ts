import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

import { db, sql } from "@openstatus/db";
import { page, selectPageSchema } from "@openstatus/db/src/schema";
import { createProtectedCookieKey } from "./lib/protected";
import { applyPageLocaleOverride } from "./lib/proxy/apply-page-locale-override";
import { composePageAction } from "./lib/proxy/compose-page-action";
import { sanitizeRedirectParam } from "./lib/proxy/sanitize-redirect-param";
import { resolveRoute } from "./lib/resolve-route";

const isSelfHosted = process.env.SELF_HOST === "true";

export default auth(async (req) => {
  const url = req.nextUrl.clone();
  const passthroughResponse = NextResponse.next();
  const host = req.headers.get("x-forwarded-host");

  const initialRoute = resolveRoute({
    host,
    urlHost: url.host,
    pathname: url.pathname,
  });

  if (!initialRoute) {
    return passthroughResponse;
  }

  const query = await db
    .select()
    .from(page)
    .where(
      sql`lower(${page.slug}) = ${initialRoute.prefix} OR lower(${page.customDomain}) = ${initialRoute.prefix}`,
    )
    .get();

  const validation = selectPageSchema.safeParse(query);

  if (!validation.success) {
    return passthroughResponse;
  }

  const _page = validation.data;
  const route = applyPageLocaleOverride(initialRoute, _page);

  // Vercel overwrites x-forwarded-for with the verified client IP — not spoofable.
  // https://vercel.com/docs/headers/request-headers#x-forwarded-for
  const xff = req.headers.get("x-forwarded-for");
  const clientIp = xff?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip");

  console.log("[proxy] request", {
    host,
    pathname: url.pathname,
    slug: _page.slug,
    customDomain: _page.customDomain || null,
    accessType: _page.accessType,
    route,
    authEmailPresent: !!req.auth?.user?.email,
    clientIp: clientIp ?? null,
    isSelfHosted,
  });

  const action = composePageAction({
    route,
    page: _page,
    host,
    urlHost: url.host,
    pathname: url.pathname,
    search: url.search,
    isSelfHosted,
    requestUrl: req.url,
    origin: req.nextUrl.origin,
    cookiePassword: req.cookies.get(createProtectedCookieKey(_page.slug))
      ?.value,
    queryPassword: url.searchParams.get("pw"),
    redirectParam: sanitizeRedirectParam(url.searchParams.get("redirect")),
    authEmail: req.auth?.user?.email,
    clientIp,
  });

  console.log("[proxy] action", {
    type: action.type,
    reason: action.reason,
    url: action.url?.toString() ?? null,
  });

  switch (action.type) {
    case "redirect":
      return NextResponse.redirect(action.url);
    case "rewrite":
      return NextResponse.rewrite(action.url);
    case "passthrough":
      return passthroughResponse;
  }
});

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
