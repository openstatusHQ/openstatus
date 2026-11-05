import { Code, ConnectError } from "@connectrpc/connect";
import { parseZodErrorIssues } from "@openstatus/error";
import {
  ConcurrentUpdateError,
  LimitExceededError,
  NotFoundError,
  type ServiceContext,
  ServiceError,
} from "@openstatus/services";
import { ZodError } from "zod";

import { tb } from "@/libs/clients";
import { ErrorReason, rpcError } from "@/libs/errors/rpc";

import { planFeatureNotAvailableError, planLimitReachedError } from "./errors";
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
/** Service entity → resource-specific reason and the metadata key for its id. */
const NOT_FOUND_REASONS: Record<string, [ErrorReason, string]> = {
  monitor: [ErrorReason.MONITOR_NOT_FOUND, "monitorId"],
  notification: [ErrorReason.NOTIFICATION_NOT_FOUND, "notificationId"],
  page: [ErrorReason.STATUS_PAGE_NOT_FOUND, "pageId"],
  page_component: [ErrorReason.PAGE_COMPONENT_NOT_FOUND, "pageComponentId"],
  page_component_group: [ErrorReason.COMPONENT_GROUP_NOT_FOUND, "groupId"],
  status_report: [ErrorReason.STATUS_REPORT_NOT_FOUND, "statusReportId"],
  maintenance: [ErrorReason.MAINTENANCE_NOT_FOUND, "maintenanceId"],
  private_location: [
    ErrorReason.PRIVATE_LOCATION_NOT_FOUND,
    "privateLocationId",
  ],
  incident: [ErrorReason.INCIDENT_NOT_FOUND, "incidentId"],
};

function notFoundError(err: ServiceError) {
  if (!(err instanceof NotFoundError)) {
    return rpcError({
      code: Code.NotFound,
      reason: ErrorReason.NOT_FOUND,
      message: err.message,
    });
  }
  const id = err.id === undefined ? undefined : String(err.id);
  const known = NOT_FOUND_REASONS[err.entity];
  const metadata: Record<string, string> = { resource: err.entity };
  if (id !== undefined) metadata[known?.[1] ?? "id"] = id;
  return rpcError({
    code: Code.NotFound,
    reason: known?.[0] ?? ErrorReason.NOT_FOUND,
    message: err.message,
    metadata,
  });
}

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
  // A lost race is retryable; other conflicts need the caller to change state.
  if (err instanceof ConcurrentUpdateError) {
    throw rpcError({
      code: Code.Aborted,
      reason: ErrorReason.CONFLICT,
      message: err.message,
    });
  }
  if (err instanceof ServiceError) {
    switch (err.code) {
      case "NOT_FOUND":
        throw notFoundError(err);
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
        // Covers cross-entity mismatches too (a maintenance spanning two pages),
        // so FailedPrecondition (400) rather than AlreadyExists (409).
        throw rpcError({
          code: Code.FailedPrecondition,
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
      case "LIMIT_EXCEEDED":
        if (!(err instanceof LimitExceededError)) {
          throw rpcError({
            code: Code.PermissionDenied,
            reason: ErrorReason.PLAN_LIMIT_REACHED,
            message: err.message,
          });
        }
        // Services gate boolean entitlements as a limit of 0.
        if (err.max === 0) {
          throw planFeatureNotAvailableError(err.message, err.limit);
        }
        throw planLimitReachedError(
          err.message,
          err.limit,
          err.max,
          err.current,
        );
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
