import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { getLogger } from "@logtape/logtape";

import { OpenStatusApiError } from "@/libs/errors";
import {
  ERROR_CODE_TO_CONNECT,
  ErrorReason,
  rpcError,
  withErrorInfo,
} from "@/libs/errors/rpc";

import { RPC_CONTEXT_KEY } from "./auth";

const logger = getLogger("api-server");

/**
 * Opaque `Internal` error for anything we didn't classify. The request id is
 * the only detail that crosses the wire — it's the handle support needs to
 * find the real cause in the logs.
 */
export function internalError(requestId?: string): ConnectError {
  return rpcError({
    code: Code.Internal,
    reason: ErrorReason.INTERNAL_SERVER_ERROR,
    message: requestId
      ? `Internal server error (request id: ${requestId})`
      : "Internal server error",
  });
}

/**
 * Outermost interceptor: every error leaving the RPC layer is a ConnectError
 * carrying `google.rpc.ErrorInfo` with `requestId` and `docs`.
 */
export function errorInterceptor(): Interceptor {
  return (next) => async (req) => {
    try {
      return await next(req);
    } catch (error) {
      const rpcCtx = req.contextValues.get(RPC_CONTEXT_KEY);
      // Auth failures throw before the context exists; the bridge stamps the
      // Hono request id on the header for exactly that case.
      const requestId =
        rpcCtx?.requestId ?? req.header.get("x-request-id") ?? undefined;

      if (error instanceof ConnectError) {
        throw withErrorInfo(error, requestId);
      }

      if (error instanceof OpenStatusApiError) {
        const code = ERROR_CODE_TO_CONNECT[error.code] ?? Code.Internal;

        // Log server errors (5xx equivalent)
        if (error.status >= 500) {
          logger.error("RPC server error", {
            error: {
              code: error.code,
              message: error.message,
            },
            requestId,
          });
        }

        throw withErrorInfo(
          rpcError({ code, reason: error.code, message: error.message }),
          requestId,
        );
      }

      // Unknown error - log and wrap as Internal
      logger.error("RPC unexpected error", {
        error: {
          name: error instanceof Error ? error.name : "Unknown",
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        requestId,
      });

      // Never forward the raw message: drizzle's `DrizzleQueryError` embeds
      // the full SQL and bound params, which would leak schema and other
      // rows' ids to the API client.
      throw withErrorInfo(internalError(requestId), requestId);
    }
  };
}
