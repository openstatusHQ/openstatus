import type { Page } from "@openstatus/db/src/schema";
import type { ResolvedRoute } from "../resolve-route";
import { buildExternalPath } from "./build-external-path";
import type { Action } from "./types";

interface Input {
  route: ResolvedRoute;
  page: Pick<Page, "accessType" | "authEmailDomains">;
  pathname: string;
  /** `req.auth?.user?.email` — null/undefined when not signed in. */
  authEmail: string | null | undefined;
  /** req.nextUrl.origin — base for redirects built on the same host. */
  origin: string;
}

/**
 * Email-domain-gated page access control. Handles both gate-in
 * (missing/unauthorised email → /login) and gate-out (authorised email on
 * /login → page root).
 *
 * Note on `endsWith("/login")`: deliberately loose; preserved from the
 * original middleware.
 */
export function resolveEmailDomainAction({
  route,
  page,
  pathname,
  authEmail,
  origin,
}: Input): Action | null {
  if (page.accessType !== "email-domain") return null;

  const emailDomain = authEmail?.split("@")[1];
  const isAuthorised = !!(
    emailDomain && page.authEmailDomains.includes(emailDomain)
  );
  const isOnLogin = pathname.endsWith("/login");

  // Gate-in: not authorised and not on /login → send to login
  if (!isOnLogin && !isAuthorised) {
    return {
      type: "redirect",
      url: new URL(`${origin}${buildExternalPath(route, "/login")}`),
      reason: "email-domain-gate-in",
    };
  }

  // Gate-out: authorised and on /login → send to page root
  if (isOnLogin && isAuthorised) {
    return {
      type: "redirect",
      url: new URL(`${origin}${buildExternalPath(route, "")}`),
      reason: "email-domain-gate-out",
    };
  }

  return null;
}
