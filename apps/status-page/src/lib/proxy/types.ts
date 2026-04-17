/**
 * Shared types for the proxy stage pipeline.
 *
 * Each stage is a pure function that inspects its inputs and returns an Action
 * (terminal decision for the middleware) or null (pass — let the next stage try).
 * The composer runs stages in priority order and returns the first non-null
 * Action, or a passthrough Action if all stages decline.
 */

import type { Page } from "@openstatus/db/src/schema";
import type { ResolvedRoute } from "../resolve-route";

export type ActionType = "rewrite" | "redirect" | "passthrough";

interface ActionBase {
  /** Kebab-case identifier of which branch produced this action. Used in logs and tests. */
  reason: string;
}

/**
 * Discriminated union: a `rewrite` or `redirect` is guaranteed to carry a URL;
 * a `passthrough` never does. Stages and callers rely on TypeScript narrowing
 * from the `type` tag — no runtime URL-presence checks needed in the
 * dispatcher. `rewrite` and `redirect` are kept as distinct variants so
 * narrowing stays precise when the two diverge (e.g. status codes, headers).
 */
export type Action =
  | (ActionBase & { type: "rewrite"; url: URL })
  | (ActionBase & { type: "redirect"; url: URL })
  | (ActionBase & { type: "passthrough"; url?: never });

/** Passthrough action shorthand. */
export const passthrough = (reason: string): Action => ({
  type: "passthrough",
  reason,
});

/**
 * Superset of every field read by any stage. proxy.ts assembles this once per
 * request; the composer passes it through to each stage. Individual stages
 * declare narrower input types and rely on structural subtyping.
 */
export interface ComposeInput {
  route: ResolvedRoute;
  page: Page;
  host: string | null;
  urlHost: string;
  pathname: string;
  search: string;
  isSelfHosted: boolean;
  requestUrl: string;
  origin: string;
  cookiePassword: string | undefined;
  queryPassword: string | null;
  redirectParam: string | null;
  authEmail: string | null | undefined;
  clientIp: string | null | undefined;
  proxyHeader: string | null | undefined;
}
