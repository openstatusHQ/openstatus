import type { Interceptor } from "@connectrpc/connect";
import { getLogger, withContext } from "@logtape/logtape";

import { env } from "@/env";
import { RPC_CONTEXT_KEY } from "./auth";

const logger = getLogger("api-server-otel");

/**
 * Logging interceptor for ConnectRPC.
 * Implements wide events pattern - emits ONE canonical log line per RPC request.
 * All context is collected during execution and emitted at completion.
 */
export function loggingInterceptor(): Interceptor {
  return (next) => async (req) => {
    const rpcCtx = req.contextValues.get(RPC_CONTEXT_KEY);

    const serviceName = req.service.typeName;
    const methodName = req.method.name;
    const startTime = Date.now();

    // Initialize wide event - will be emitted once at completion
    const event: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      request_id: rpcCtx?.requestId ?? "unknown",
      protocol: "connectrpc",
      service: serviceName,
      method: methodName,
      // Business context
      // Environment characteristics
      environment: env.NODE_ENV,
      region: env.FLY_REGION,
    };

    // Wrap in LogTape context for correlation
    return withContext(
      {
        requestId: rpcCtx?.requestId ?? "unknown",
        service: serviceName,
        method: methodName,
        workspaceId: rpcCtx?.workspace.id,
        protocol: "connectrpc",
      },
      async () => {
        try {
          const response = await next(req);

          event.duration_ms = Date.now() - startTime;
          event.outcome = "success";
          event.workspace_id = rpcCtx?.workspace.id;
          event.workspace_plan = rpcCtx?.workspace.plan;

          return response;
        } catch (error) {
          event.duration_ms = Date.now() - startTime;
          event.outcome = "error";
          event.error = {
            type: error instanceof Error ? error.name : "UnknownError",
            message: error instanceof Error ? error.message : String(error),
          };

          throw error;
        } finally {
          // Emit single canonical log line
          logger.info("rpc_request", { ...event });
        }
      },
    );
  };
}
