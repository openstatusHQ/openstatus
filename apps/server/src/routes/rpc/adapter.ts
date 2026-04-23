import { Code, ConnectError } from "@connectrpc/connect";
import { type ServiceContext, ServiceError } from "@openstatus/services";
import { ZodError } from "zod";

import type { RpcContext } from "./interceptors";

/**
 * Translate Connect RPC auth context into a `ServiceContext`.
 *
 * TODO: Once the auth interceptor captures the API key id, expose it here
 * as `actor.keyId`. Until then we synthesise `ws:<workspaceId>` so audit
 * records still have a non-empty actor identifier — see the plan's open
 * question "Does Connect's auth interceptor capture API key ID today?".
 */
export function toServiceCtx(rpcCtx: RpcContext): ServiceContext {
  return {
    workspace: rpcCtx.workspace,
    actor: { type: "apiKey", keyId: `ws:${rpcCtx.workspace.id}` },
    requestId: rpcCtx.requestId,
  };
}

/**
 * Map any error thrown by a service call to a `ConnectError`. Preserves the
 * existing Connect error surface — granular reasons carried by the caller's
 * per-handler error helpers (in `errors.ts`) still bypass this mapper since
 * they throw `ConnectError` directly.
 */
export function toConnectError(err: unknown): never {
  if (err instanceof ConnectError) throw err;
  if (err instanceof ZodError) {
    throw new ConnectError(
      `Invalid request: ${err.message}`,
      Code.InvalidArgument,
    );
  }
  if (err instanceof ServiceError) {
    switch (err.code) {
      case "NOT_FOUND":
        throw new ConnectError(err.message, Code.NotFound);
      case "FORBIDDEN":
        throw new ConnectError(err.message, Code.PermissionDenied);
      case "UNAUTHORIZED":
        throw new ConnectError(err.message, Code.Unauthenticated);
      case "CONFLICT":
        throw new ConnectError(err.message, Code.InvalidArgument);
      case "VALIDATION":
        throw new ConnectError(err.message, Code.InvalidArgument);
      case "LIMIT_EXCEEDED":
        throw new ConnectError(err.message, Code.PermissionDenied);
      case "INTERNAL":
        throw new ConnectError(err.message, Code.Internal);
    }
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  throw new ConnectError(message, Code.Internal);
}
