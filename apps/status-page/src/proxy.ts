import { pagePasswordRateLimit } from "@openstatus/api/src/lib/page-password-rate-limit";
import { resolveClientIp } from "@openstatus/services/page-access";
import { getPublicStatusPageRow } from "@openstatus/services/public-status-page";
import { NextResponse } from "next/server";

import { auth } from "./lib/auth";
import { createProtectedCookieKey } from "./lib/protected";
import { applyPageLocaleOverride } from "./lib/proxy/apply-page-locale-override";
import { applyPageSlugPrefix } from "./lib/proxy/apply-page-slug-prefix";
import { composePageAction } from "./lib/proxy/compose-page-action";
import { detectMarkdown } from "./lib/proxy/detect-markdown";
import { gatePasswordAttempt } from "./lib/proxy/gate-password-attempt";
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
  const rewriteWithVary = (
    target: URL,
    init?: Parameters<typeof NextResponse.rewrite>[1],
  ) => {
    const response = NextResponse.rewrite(target, init);
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

  const _page = await getPublicStatusPageRow({
    input: { slug: initialRoute.prefix },
  });

  // No page for this host/slug — never fall through to the theme explorer.
  if (!_page) {
    return unresolvedHostResponse();
  }

  const route = applyPageSlugPrefix(
    applyPageLocaleOverride(initialRoute, _page),
    _page,
  );

  const clientIp = resolveClientIp(req.headers);
  const cookieKey = createProtectedCookieKey(_page.slug);
  const { queryPassword, cookiePassword, clearCookie } =
    await gatePasswordAttempt({
      page: _page,
      clientIp,
      queryPassword: url.searchParams.get("pw"),
      cookiePassword: req.cookies.get(cookieKey)?.value,
      limiter: pagePasswordRateLimit(),
    });

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
    cookiePassword,
    queryPassword,
    redirectParam: sanitizeRedirectParam(url.searchParams.get("redirect")),
    authEmail: req.auth?.user?.email,
    clientIp,
  });

  console.log("[proxy] action", {
    type: action.type,
    reason: action.reason,
    url: action.url?.toString() ?? null,
  });

  // A `?pw=` link carries no cookie yet, and the tRPC gate downstream only
  // sees cookies — forward the password as one on the internal request.
  const request =
    _page.accessType === "password" && queryPassword
      ? { headers: withPasswordCookie(req.headers, _page.slug, queryPassword) }
      : undefined;

  const response = (() => {
    switch (action.type) {
      case "redirect":
        return NextResponse.redirect(action.url);
      case "rewrite":
        return rewriteWithVary(action.url, { request });
      case "passthrough": {
        if (!request) return passthroughResponse;
        const next = NextResponse.next({ request });
        next.headers.set("Vary", "Accept");
        return next;
      }
    }
  })();
  if (clearCookie) response.cookies.delete(cookieKey);
  return response;
});

function withPasswordCookie(headers: Headers, slug: string, password: string) {
  const next = new Headers(headers);
  const cookie = `${createProtectedCookieKey(slug)}=${encodeURIComponent(password)}`;
  const existing = headers.get("cookie");
  next.set("cookie", existing ? `${existing}; ${cookie}` : cookie);
  return next;
}

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
