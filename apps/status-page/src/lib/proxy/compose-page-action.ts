import { resolveCustomDomainRewrite } from "./resolve-custom-domain-rewrite";
import { resolveDefaultRewrite } from "./resolve-default-rewrite";
import { resolveEmailDomainAction } from "./resolve-email-domain-action";
import { resolveIpRestrictionAction } from "./resolve-ip-restriction-action";
import { resolveLocaleAction } from "./resolve-locale-action";
import { resolvePasswordAction } from "./resolve-password-action";
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
 *   5. custom-domain rewrite (stpg.dev hosted)
 *   6. default rewrite (openstatus.dev OR rewritePath differs)
 *
 * Note on locale-first: a user on a mis-localed URL for a gated page gets
 * two redirects (locale → gate) instead of one. We accept the extra hop so
 * the gate and its `?redirect=` capture operate on the canonical localed
 * URL — gating first would capture the mis-localed path as the post-auth
 * target, forcing a third redirect after auth. Revisit if measured UX cost
 * outweighs the ambiguity.
 */
export function composePageAction(input: ComposeInput): Action {
  return (
    resolveLocaleAction(input) ??
    resolvePasswordAction(input) ??
    resolveEmailDomainAction(input) ??
    resolveIpRestrictionAction(input) ??
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
