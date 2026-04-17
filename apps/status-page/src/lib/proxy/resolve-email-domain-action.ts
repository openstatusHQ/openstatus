import type { Page } from "@openstatus/db/src/schema";
import { buildExternalPath } from "./build-external-path";
import type { Action, ComposeInput } from "./types";

type Input = Pick<
  ComposeInput,
  "route" | "pathname" | "authEmail" | "redirectParam" | "origin"
> & {
  page: Pick<Page, "accessType" | "authEmailDomains">;
};

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
  redirectParam,
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

  // Gate-out: authorised and on /login → send to the originally-requested path
  // (if provided) or page root. Mirrors password-gate-out's redirect-honouring.
  if (isOnLogin && isAuthorised) {
    const target = redirectParam ?? buildExternalPath(route, "");
    return {
      type: "redirect",
      url: new URL(`${origin}${target}`),
      reason: "email-domain-gate-out",
    };
  }

  return null;
}
