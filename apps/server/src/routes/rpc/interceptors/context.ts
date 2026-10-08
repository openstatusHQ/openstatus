import { Code, ConnectError, createContextKey } from "@connectrpc/connect";
import type { Scope, Workspace } from "@openstatus/db/src/schema";

/**
 * RPC context containing workspace and request information.
 * This is set by the auth interceptor and available to all handlers.
 */
export interface RpcContext {
  workspace: Workspace;
  requestId: string;
  /**
   * Resolved API key identity. `id` is the stable key identifier (audit
   * `actor_id`); `createdById` is the openstatus user who created the
   * key (`api_key.created_by_id`, audit `actor_user_id`).
   * `scopes` carries the access-control scopes for the resolved key —
   * `requireScope` reads them inside service write verbs.
   */
  apiKey: { id: string; createdById?: number; scopes: Scope[] };
}

/**
 * Context key for storing RPC context in request context values.
 *
 * Lives here rather than in `auth.ts` so interceptors that only need to
 * read the context don't pull in the auth middleware's dependency chain.
 */
export const RPC_CONTEXT_KEY = createContextKey<RpcContext | undefined>(
  undefined,
);

/**
 * Helper to get RPC context from handler context.
 */
export function getRpcContext(ctx: {
  values: { get: <T>(key: { id: symbol; defaultValue: T }) => T };
}): RpcContext {
  const rpcCtx = ctx.values.get(RPC_CONTEXT_KEY);
  if (!rpcCtx) {
    throw new ConnectError(
      "RPC context not found - auth interceptor may not have run",
      Code.Internal,
    );
  }
  return rpcCtx;
}
