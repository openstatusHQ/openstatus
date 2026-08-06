import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { getLogger } from "@logtape/logtape";
import type { ErrorCode } from "@openstatus/error";

import { OpenStatusApiError } from "@/libs/errors";

import { RPC_CONTEXT_KEY } from "./auth";

const logger = getLogger("api-server");

/**
 * Mapping from OpenStatus error codes to ConnectRPC codes.
 */
const ERROR_CODE_MAP: Record<ErrorCode, Code> = {
  BAD_REQUEST: Code.InvalidArgument,
  UNAUTHORIZED: Code.Unauthenticated,
  PAYMENT_REQUIRED: Code.ResourceExhausted,
  FORBIDDEN: Code.PermissionDenied,
  NOT_FOUND: Code.NotFound,
  METHOD_NOT_ALLOWED: Code.Unimplemented,
  CONFLICT: Code.AlreadyExists,
  UNPROCESSABLE_ENTITY: Code.InvalidArgument,
  INTERNAL_SERVER_ERROR: Code.Internal,
};

/**
 * Opaque `Internal` error for anything we didn't classify. The request id is
 * the only detail that crosses the wire — it's the handle support needs to
 * find the real cause in the logs.
 */
export function internalError(requestId?: string): ConnectError {
  return new ConnectError(
    requestId
      ? `Internal server error (request id: ${requestId})`
      : "Internal server error",
    Code.Internal,
  );
}

/**
 * Error mapping interceptor for ConnectRPC.
 * Converts OpenStatusApiError to ConnectError with appropriate codes.
 * Logs server errors and passes through client errors.
 */
export function errorInterceptor(): Interceptor {
  return (next) => async (req) => {
    try {
      return await next(req);
    } catch (error) {
      const rpcCtx = req.contextValues.get(RPC_CONTEXT_KEY);

      // Already a ConnectError, pass through
      if (error instanceof ConnectError) {
        throw error;
      }

      // Map OpenStatusApiError to ConnectError
      if (error instanceof OpenStatusApiError) {
        const code = ERROR_CODE_MAP[error.code] ?? Code.Internal;

        // Log server errors (5xx equivalent)
        if (error.status >= 500) {
          logger.error("RPC server error", {
            error: {
              code: error.code,
              message: error.message,
            },
            requestId: rpcCtx?.requestId,
          });
        }

        throw new ConnectError(error.message, code);
      }

      // Unknown error - log and wrap as Internal
      logger.error("RPC unexpected error", {
        error: {
          name: error instanceof Error ? error.name : "Unknown",
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        requestId: rpcCtx?.requestId,
      });

      // Never forward the raw message: drizzle's `DrizzleQueryError` embeds
      // the full SQL and bound params, which would leak schema and other
      // rows' ids to the API client.
      throw internalError(rpcCtx?.requestId);
    }
  };
}
