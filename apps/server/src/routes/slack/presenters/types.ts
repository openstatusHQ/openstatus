import type { ServiceContext } from "@openstatus/services";

/**
 * Per-tool presenter. The runner calls it after the registry tool's
 * `run` succeeds; the presenter returns the user-visible chat.update
 * text. Presenters can `await` for status-page URL lookups (the slack
 * route is server-only — `node:*` imports are fine here, unlike inside
 * `@openstatus/services`).
 */
export type Presenter = (args: {
  input: unknown;
  output: unknown;
  ctx: ServiceContext;
  notify: boolean;
}) => Promise<string> | string;
