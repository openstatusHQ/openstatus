import { Code, ConnectError } from "@connectrpc/connect";
import { parseZodErrorIssues } from "@openstatus/error";
import {
  LimitExceededError,
  NotFoundError,
  type ServiceContext,
  ServiceError,
} from "@openstatus/services";
import { ZodError } from "zod";

import { tb } from "@/libs/clients";
import { ErrorReason, rpcError } from "@/libs/errors/rpc";

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
 * Map any error thrown by a service call to a `ConnectError`. Granular
 * reasons from the per-handler `errors.ts` helpers bypass this mapper since
 * they already are ConnectErrors. Errors it can't classify propagate
 * untouched to `errorInterceptor`, which logs and redacts them.
 */
export function toConnectError(err: unknown): never {
  if (err instanceof ConnectError) throw err;
  if (err instanceof ZodError) {
    throw rpcError({
      code: Code.InvalidArgument,
      reason: ErrorReason.VALIDATION_FAILED,
      message: `Invalid request: ${parseZodErrorIssues(err.issues)}`,
      fieldViolations: err.issues.map((issue) => ({
        field: issue.path.map(String).join("."),
        description: issue.message,
      })),
      cause: err,
    });
  }
  if (err instanceof ServiceError) {
    switch (err.code) {
      case "NOT_FOUND":
        throw rpcError({
          code: Code.NotFound,
          reason: ErrorReason.NOT_FOUND,
          message: err.message,
          metadata:
            err instanceof NotFoundError ? { resource: err.entity } : undefined,
        });
      case "FORBIDDEN":
        throw rpcError({
          code: Code.PermissionDenied,
          reason: ErrorReason.FORBIDDEN,
          message: err.message,
        });
      case "UNAUTHORIZED":
        throw rpcError({
          code: Code.Unauthenticated,
          reason: ErrorReason.UNAUTHORIZED,
          message: err.message,
        });
      case "CONFLICT":
        // Services raise ConflictError for cross-entity mismatches too (a
        // maintenance spanning two pages), and the RPC contract pins those to
        // 400, so this stays InvalidArgument rather than AlreadyExists.
        throw rpcError({
          code: Code.InvalidArgument,
          reason: ErrorReason.CONFLICT,
          message: err.message,
        });
      case "VALIDATION":
        throw rpcError({
          code: Code.InvalidArgument,
          reason: ErrorReason.VALIDATION_FAILED,
          message: err.message,
          cause: err.cause,
        });
      case "LIMIT_EXCEEDED": {
        // PermissionDenied, same as the handler-level `planLimitReachedError`:
        // the docs pin plan gating to 403, and ResourceExhausted would tell
        // clients to retry a quota that only an upgrade lifts.
        const metadata: Record<string, string> = {};
        if (err instanceof LimitExceededError) {
          metadata.limit = err.limit;
          metadata.max = String(err.max);
          if (err.current !== undefined) metadata.current = String(err.current);
        }
        throw rpcError({
          code: Code.PermissionDenied,
          reason: ErrorReason.PLAN_LIMIT_REACHED,
          message: err.message,
          metadata,
        });
      }
      case "PRECONDITION_FAILED":
        throw rpcError({
          code: Code.FailedPrecondition,
          reason: ErrorReason.UNPROCESSABLE_ENTITY,
          message: err.message,
        });
      case "INTERNAL":
        throw rpcError({
          code: Code.Internal,
          reason: ErrorReason.INTERNAL_SERVER_ERROR,
          message: err.message,
          cause: err.cause,
        });
    }
  }
  // Unclassified: rethrow raw so `errorInterceptor` handles it. Only the
  // interceptor holds the `RpcContext`, so it's the only layer that can put
  // the request id in both the log line and the client's message.
  throw err;
}
