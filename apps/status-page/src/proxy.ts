import { db, sql } from "@openstatus/db";
import { page, selectPageSchema } from "@openstatus/db/src/schema";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "./lib/auth";
import { isSelfHosted, stripHostPort } from "./lib/domain";
import { resolveClientIp } from "./lib/http/client-ip";
import { PAGE_SLUG_HEADER } from "./lib/page-slug";
import { createProtectedCookieKey } from "./lib/protected";
import { applyPageLocaleOverride } from "./lib/proxy/apply-page-locale-override";
import { composePageAction } from "./lib/proxy/compose-page-action";
import { detectMarkdown } from "./lib/proxy/detect-markdown";
import { sanitizeRedirectParam } from "./lib/proxy/sanitize-redirect-param";
import { resolveRoute } from "./lib/resolve-route";

// This middleware is NOT wrapped with auth() to avoid enforcing authentication
// on all requests. The auth() wrapper would require authentication for ALL matched
// routes, preventing public status pages from being accessible. This is especially
// critical for self-hosted deployments where everything runs on the same domain/IP.
// Instead, we fetch the session optionally and let composePageAction() decide based
// on the page's accessType (public/password/email-domain) whether auth is required.
export default async function middleware(req: NextRequest) {
  const session = await auth();

  const url = req.nextUrl.clone();
  const passthroughResponse = NextResponse.next();
  // HTML and markdown share the same URL (negotiated by Accept) — tell shared
  // caches to key on it so a markdown variant is never served to a browser.
  passthroughResponse.headers.set("Vary", "Accept");
  const host = stripHostPort(req.headers.get("x-forwarded-host"));

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
    return passthroughResponse;
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

  if (!validation.success) {
    return passthroughResponse;
  }

  const _page = validation.data;
  let route = applyPageLocaleOverride(initialRoute, _page);

  // Fix route prefix for self-hosted custom domains
  // When accessing via custom domain, route.prefix is set to the custom domain
  // instead of the slug, breaking all downstream rewrite logic
  if (
    isSelfHosted() &&
    _page.customDomain &&
    route.prefix === _page.customDomain
  ) {
    const customDomainPrefix = `/${_page.customDomain}`;
    const slugPrefix = `/${_page.slug}`;

    // Replace the custom domain prefix with slug at the start of the path
    // This is more precise than replace() and only affects the prefix
    let correctedPath = route.rewritePath;
    if (correctedPath.startsWith(customDomainPrefix)) {
      correctedPath =
        slugPrefix + correctedPath.slice(customDomainPrefix.length);
    }

    route = {
      ...route,
      prefix: _page.slug,
      rewritePath: correctedPath,
    };
  }

  const clientIp = resolveClientIp(req.headers);

  // In self-hosted mode with custom domains, we need to handle redirects and
  // rewrites differently:
  // - Redirects (user-facing): Use the custom domain so users stay on status.zptx.net
  // - Rewrites (internal): Use the internal origin so Next.js doesn't make external requests
  let redirectBaseUrl = req.url;
  let redirectOrigin = req.nextUrl.origin;
  if (isSelfHosted() && _page.customDomain && host) {
    const protocol = req.nextUrl.protocol || "https:";
    const parsedUrl = new URL(req.url);
    redirectBaseUrl = `${protocol}//${host}${parsedUrl.pathname}${parsedUrl.search}`;
    redirectOrigin = `${protocol}//${host}`;
  }

  const action = composePageAction({
    route,
    page: _page,
    host,
    urlHost: url.host,
    pathname: url.pathname,
    search: url.search,
    isSelfHosted: isSelfHosted(),
    requestUrl: req.url, // Keep internal origin for rewrites
    redirectBaseUrl, // Use custom domain for redirects
    origin: redirectOrigin, // Use custom domain for redirects
    cookiePassword: req.cookies.get(createProtectedCookieKey(_page.slug))
      ?.value,
    queryPassword: url.searchParams.get("pw"),
    redirectParam: sanitizeRedirectParam(url.searchParams.get("redirect")),
    authEmail: session?.user?.email,
    clientIp,
  });

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(PAGE_SLUG_HEADER, _page.slug);

  switch (action.type) {
    case "redirect":
      return NextResponse.redirect(action.url);
    case "rewrite": {
      // HTML served via internal rewrite shares its URL with the markdown
      // variant — carry the same Vary so caches don't cross them.
      const rewriteResponse = NextResponse.rewrite(action.url, {
        request: { headers: requestHeaders },
      });
      rewriteResponse.headers.set("Vary", "Accept");
      return rewriteResponse;
    }
    case "passthrough": {
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });
      response.headers.set("Vary", "Accept");
      return response;
    }
  }
}

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
