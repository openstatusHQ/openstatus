import { Code, ConnectError } from "@connectrpc/connect";
import { type ServiceContext, ServiceError } from "@openstatus/services";
import { ZodError } from "zod";

import { tb } from "@/libs/clients";

import type { RpcContext } from "./interceptors";

/**
 * Translate Connect RPC auth context into a `ServiceContext`. The
 * `apiKeyId` is the real key identifier captured by the auth
 * interceptor — audit rows can attribute mutations to the specific key.
 */
export function toServiceCtx(rpcCtx: RpcContext): ServiceContext {
  return {
    workspace: rpcCtx.workspace,
    actor: {
      type: "apiKey",
      keyId: rpcCtx.apiKey.id,
      userId: rpcCtx.apiKey.createdById,
      scopes: rpcCtx.apiKey.scopes,
    },
    requestId: rpcCtx.requestId,
    tb,
  };
}

/**
 * Map any error thrown by a service call to a `ConnectError`. Preserves the
 * existing Connect error surface — granular reasons carried by the caller's
 * per-handler error helpers (in `errors.ts`) still bypass this mapper since
 * they throw `ConnectError` directly. Errors it can't classify propagate
 * untouched to `errorInterceptor`, which logs and redacts them.
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
        throw new ConnectError(err.message, Code.ResourceExhausted);
      case "PRECONDITION_FAILED":
        throw new ConnectError(err.message, Code.FailedPrecondition);
      case "INTERNAL":
        throw new ConnectError(err.message, Code.Internal);
    }
  }
  // Unclassified: rethrow raw so `errorInterceptor` handles it. Only the
  // interceptor holds the `RpcContext`, so it's the only layer that can put
  // the request id in both the log line and the client's message.
  throw err;
}
