import type { Page } from "@openstatus/db/src/schema";
import type { ResolvedRoute } from "../resolve-route";
import { buildExternalPath } from "./build-external-path";
import type { Action } from "./types";

interface Input {
  route: ResolvedRoute;
  page: Pick<Page, "slug" | "customDomain" | "password" | "accessType">;
  /** req.nextUrl.pathname — used to detect the /login gate and to build return URLs. */
  pathname: string;
  /** x-forwarded-host header — compared against `{slug}.stpg.dev` to decide custom-domain vs apex hosting. */
  host: string | null;
  isSelfHosted: boolean;
  cookiePassword: string | undefined;
  queryPassword: string | null;
  /** Value of `?redirect=` on the current URL. Read by the gate-out branch. */
  redirectParam: string | null;
  /** req.nextUrl.origin — base for redirect URLs built on the same host. */
  origin: string;
}

/**
 * Password-protected page access control. Handles both gate-in (wrong password
 * → /login) and gate-out (correct password + on /login → page root), including
 * the custom-domain variants that redirect to `https://{customDomain}` instead
 * of the current host.
 *
 * Returns null if the page is not password-protected, or if the request is
 * already in the right state (authorised elsewhere, not on /login).
 *
 * Note on `endsWith("/login")`: deliberately loose — also matches
 * `/some-login`. Preserved from the original middleware; tighten to
 * last-segment equality in a follow-up if needed.
 */
export function resolvePasswordAction({
  route,
  page,
  pathname,
  host,
  isSelfHosted,
  cookiePassword,
  queryPassword,
  redirectParam,
  origin,
}: Input): Action | null {
  if (page.accessType !== "password") return null;

  const password = queryPassword || cookiePassword;
  const isOnLogin = pathname.endsWith("/login");
  const needsCustomDomainRedirect =
    !isSelfHosted && !!page.customDomain && host !== `${page.slug}.stpg.dev`;

  // Gate-in: wrong password and not already on /login → send to login
  if (password !== page.password && !isOnLogin) {
    if (needsCustomDomainRedirect) {
      const leading = `/${page.customDomain}`;
      const redirect = pathname.startsWith(leading)
        ? pathname.slice(leading.length)
        : pathname;
      return {
        type: "redirect",
        url: new URL(
          `https://${page.customDomain}/login?redirect=${encodeURIComponent(redirect)}`,
        ),
        reason: "password-gate-in-custom-domain",
      };
    }
    return {
      type: "redirect",
      url: new URL(
        `${origin}${buildExternalPath(route, "/login")}?redirect=${encodeURIComponent(pathname)}`,
      ),
      reason: "password-gate-in",
    };
  }

  // Gate-out: correct password and on /login → send to page root
  if (password === page.password && isOnLogin) {
    if (needsCustomDomainRedirect) {
      return {
        type: "redirect",
        url: new URL(`https://${page.customDomain}${redirectParam ?? "/"}`),
        reason: "password-gate-out-custom-domain",
      };
    }
    // Parentheses matter: without them, `redirectParam ?? route.type === "pathname"`
    // binds first, making the ternary condition always truthy when `redirectParam`
    // is a non-null string — so the redirect param would be ignored.
    return {
      type: "redirect",
      url: new URL(
        `${origin}${
          redirectParam ??
          (route.type === "pathname" ? `/${route.prefix}` : "/")
        }`,
      ),
      reason: "password-gate-out",
    };
  }

  return null;
}
