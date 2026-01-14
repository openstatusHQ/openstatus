import type { Interceptor } from "@connectrpc/connect";
import { getLogger, withContext } from "@logtape/logtape";

import { RPC_CONTEXT_KEY } from "./auth";

const logger = getLogger("api-server");

/**
 * Logging interceptor for ConnectRPC.
 * Integrates with LogTape for structured JSON logging.
 * Logs request start, completion, and errors with duration.
 */
export function loggingInterceptor(): Interceptor {
  return (next) => async (req) => {
    const rpcCtx = req.contextValues.get(RPC_CONTEXT_KEY);

    const serviceName = req.service.typeName;
    const methodName = req.method.name;
    const startTime = Date.now();

    // Wrap in LogTape context for structured logging
    return withContext(
      {
        requestId: rpcCtx?.requestId ?? "unknown",
        service: serviceName,
        method: methodName,
        workspaceId: rpcCtx?.workspace.id,
        protocol: "connectrpc",
      },
      async () => {
        logger.info("RPC request started", {
          service: serviceName,
          method: methodName,
          requestId: rpcCtx?.requestId,
        });

        try {
          const response = await next(req);

          const duration = Date.now() - startTime;
          logger.info("RPC request completed", {
            service: serviceName,
            method: methodName,
            duration,
            requestId: rpcCtx?.requestId,
          });

          return response;
        } catch (error) {
          const duration = Date.now() - startTime;
          logger.error("RPC request failed", {
            service: serviceName,
            method: methodName,
            duration,
            requestId: rpcCtx?.requestId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          throw error;
        }
      },
    );
  };
}
