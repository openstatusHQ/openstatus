import {
  Code,
  ConnectError,
  type Interceptor,
  createContextKey,
} from "@connectrpc/connect";
import type { Workspace } from "@openstatus/db/src/schema";
import { nanoid } from "nanoid";

import { lookupWorkspace, validateKey } from "@/libs/middlewares/auth";

/**
 * RPC context containing workspace and request information.
 * This is set by the auth interceptor and available to all handlers.
 */
export interface RpcContext {
  workspace: Workspace;
  requestId: string;
}

/**
 * Context key for storing RPC context in request context values.
 */
export const RPC_CONTEXT_KEY = createContextKey<RpcContext | undefined>(
  undefined
);

/**
 * Authentication interceptor for ConnectRPC.
 * Validates the x-openstatus-key header and sets workspace context.
 * Skips authentication for HealthService endpoints.
 */
export function authInterceptor(): Interceptor {
  return (next) => async (req) => {
    // Skip auth for HealthService
    if (req.service.typeName === "openstatus.health.v1.HealthService") {
      return next(req);
    }

    const apiKey = req.header.get("x-openstatus-key");

    if (!apiKey) {
      throw new ConnectError(
        "Missing 'x-openstatus-key' header",
        Code.Unauthenticated
      );
    }

    const { error, result } = await validateKey(apiKey);

    if (error) {
      throw new ConnectError(error.message, Code.Unauthenticated);
    }

    if (!result.valid || !result.ownerId) {
      throw new ConnectError("Invalid API Key", Code.Unauthenticated);
    }

    const ownerId = Number.parseInt(result.ownerId);

    if (Number.isNaN(ownerId)) {
      throw new ConnectError("Invalid API Key format", Code.Unauthenticated);
    }

    // lookupWorkspace throws OpenStatusApiError if not found
    // The error interceptor will convert it to ConnectError
    const workspace = await lookupWorkspace(ownerId);

    // Generate request ID if not provided
    const requestId = req.header.get("x-request-id") ?? nanoid();

    // Store context for handlers to access
    const rpcContext: RpcContext = {
      workspace,
      requestId,
    };

    // Set context using ConnectRPC's context values
    req.contextValues.set(RPC_CONTEXT_KEY, rpcContext);

    return next(req);
  };
}

/**
 * Helper to get RPC context from handler context.
 */
export function getRpcContext(ctx: { values: { get: <T>(key: { id: symbol; defaultValue: T }) => T } }): RpcContext {
  const rpcCtx = ctx.values.get(RPC_CONTEXT_KEY);
  if (!rpcCtx) {
    throw new ConnectError(
      "RPC context not found - auth interceptor may not have run",
      Code.Internal
    );
  }
  return rpcCtx;
}
