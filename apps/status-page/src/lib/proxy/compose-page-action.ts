import { resolveCustomDomainRewrite } from "./resolve-custom-domain-rewrite";
import { resolveDefaultRewrite } from "./resolve-default-rewrite";
import { resolveEmailDomainAction } from "./resolve-email-domain-action";
import { resolveIpRestrictionAction } from "./resolve-ip-restriction-action";
import { resolveLocaleAction } from "./resolve-locale-action";
import { resolvePasswordAction } from "./resolve-password-action";
import { resolveProxyHeaderAction } from "./resolve-proxy-header-action";
import { type Action, type ComposeInput, passthrough } from "./types";

export type { ComposeInput };

/**
 * Runs the proxy stages in priority order and returns the first non-null
 * Action. If every stage passes, returns a `passthrough` action.
 *
 * Priority ordering (top wins):
 *   1. locale-mismatch redirect
 *   2. password gate (in/out)
 *   3. email-domain gate (in/out)
 *   4. ip-restriction gate (in/out)
 *   5. x-proxy header rewrite
 *   6. custom-domain rewrite (stpg.dev hosted)
 *   7. default rewrite (openstatus.dev OR rewritePath differs)
 */
export function composePageAction(input: ComposeInput): Action {
  return (
    resolveLocaleAction(input) ??
    resolvePasswordAction(input) ??
    resolveEmailDomainAction(input) ??
    resolveIpRestrictionAction(input) ??
    resolveProxyHeaderAction(input) ??
    resolveCustomDomainRewrite(input) ??
    resolveDefaultRewrite(input) ??
    // Reached whenever resolveDefaultRewrite declines: host is not an
    // openstatus.dev host AND route.rewritePath === pathname. In hosted
    // deployments this is rare because one of those conditions almost always
    // triggers. In self-hosted mode (no openstatus.dev host) it fires for any
    // request whose resolved route already matches the URL — expect to see
    // `reason: "no-match"` in those logs. The dispatcher turns it into
    // NextResponse.next() (passthrough).
    passthrough("no-match")
  );
}
