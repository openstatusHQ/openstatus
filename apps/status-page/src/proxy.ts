import { db, sql } from "@openstatus/db";
import { page, selectPageSchema } from "@openstatus/db/src/schema";
import { NextResponse } from "next/server";

import { auth } from "./lib/auth";
import { resolveClientIp } from "./lib/http/client-ip";
import { createProtectedCookieKey } from "./lib/protected";
import { applyPageLocaleOverride } from "./lib/proxy/apply-page-locale-override";
import { applyPageSlugPrefix } from "./lib/proxy/apply-page-slug-prefix";
import { composePageAction } from "./lib/proxy/compose-page-action";
import { detectMarkdown } from "./lib/proxy/detect-markdown";
import { redactLogPathname, redactLogUrl } from "./lib/proxy/redact-log-url";
import { resolveUnresolvedHostAction } from "./lib/proxy/resolve-unresolved-host-action";
import { sanitizeRedirectParam } from "./lib/proxy/sanitize-redirect-param";
import { resolveRoute } from "./lib/resolve-route";

const isSelfHosted = process.env.SELF_HOST === "true";

export default auth(async (req) => {
  const url = req.nextUrl.clone();
  const passthroughResponse = NextResponse.next();

  // HTML and markdown share the same URL (negotiated by Accept) — tell shared
  // caches to key on it so a markdown variant is never served to a browser.
  passthroughResponse.headers.set("Vary", "Accept");
  const host = req.headers.get("x-forwarded-host");

  // HTML served via internal rewrite shares its URL with the markdown variant —
  // carry the same Vary as the passthrough so caches don't cross them.
  const rewriteWithVary = (target: URL) => {
    const response = NextResponse.rewrite(target);
    response.headers.set("Vary", "Accept");
    return response;
  };

  // `/` is the theme explorer, so a host that resolves to no page must 404
  // rather than fall through to it.
  const unresolvedHostResponse = () => {
    const action = resolveUnresolvedHostAction({
      host,
      urlHost: url.host,
      requestUrl: req.url,
    });
    if (action.type !== "rewrite") return passthroughResponse;
    return rewriteWithVary(action.url);
  };

  // Strip a `.md` suffix before route resolution so path-based markdown
  // (`/foo/en/monitors/123.md`) parses slug/locale correctly.
  const { wantsMarkdown, source, pathname } = detectMarkdown({
    pathname: url.pathname,
    accept: req.headers.get("accept"),
  });

  const initialRoute = resolveRoute({
    host,
    urlHost: url.host,
    pathname,
  });

  if (!initialRoute) {
    return unresolvedHostResponse();
  }

  // Markdown requests bypass the proxy's DB lookup and gate chain: the route is
  // reachable directly via `/api` anyway, so it re-validates every gate itself.
  // Short-circuiting before the gates avoids 307-redirecting a gated `.md` to
  // /login (it would never reach the route).
  if (wantsMarkdown) {
    const rewriteUrl = url.clone();
    rewriteUrl.pathname = `/api/markdown${initialRoute.rewritePath}`;
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-md-source", source ?? "header");
    return NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    });
  }

  const query = await db
    .select()
    .from(page)
    .where(
      sql`lower(${page.slug}) = ${initialRoute.prefix} OR lower(${page.customDomain}) = ${initialRoute.prefix}`,
    )
    .get();

  const validation = selectPageSchema.safeParse(query);

  // No page for this host/slug — never fall through to the theme explorer.
  if (!validation.success) {
    return unresolvedHostResponse();
  }

  const _page = validation.data;
  const route = applyPageSlugPrefix(
    applyPageLocaleOverride(initialRoute, _page),
    _page,
  );

  const clientIp = resolveClientIp(req.headers);

  console.log("[proxy] request", {
    host,
    pathname: redactLogPathname(url.pathname),
    slug: _page.slug,
    customDomain: _page.customDomain || null,
    accessType: _page.accessType,
    route: { ...route, rewritePath: redactLogPathname(route.rewritePath) },
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
    url: redactLogUrl(action.url),
  });

  switch (action.type) {
    case "redirect":
      return NextResponse.redirect(action.url);
    case "rewrite":
      return rewriteWithVary(action.url);
    case "passthrough":
      return passthroughResponse;
  }
});

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
