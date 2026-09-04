import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { nanoid } from "nanoid";

import { lookupWorkspace, validateKey } from "../../../libs/middlewares/auth";
import { RPC_CONTEXT_KEY, type RpcContext } from "./context";

export { RPC_CONTEXT_KEY, type RpcContext, getRpcContext } from "./context";

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
        Code.Unauthenticated,
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

    // Store context for handlers to access. `keyId` falls back to a
    // workspace-scoped placeholder when `validateKey` couldn't capture
    // a stable id (shouldn't happen post-migration, but keeps this
    // safe).
    const rpcContext: RpcContext = {
      workspace,
      requestId,
      apiKey: {
        id: result.keyId ?? `ws:${workspace.id}`,
        createdById: result.createdById,
        scopes: result.scopes ?? ["write"],
      },
    };

    // Set context using ConnectRPC's context values
    req.contextValues.set(RPC_CONTEXT_KEY, rpcContext);

    return next(req);
  };
}
