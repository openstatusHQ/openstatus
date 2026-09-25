import { Code, type Interceptor } from "@connectrpc/connect";
import { nanoid } from "nanoid";

import { ErrorReason, rpcError } from "@/libs/errors/rpc";

import { lookupWorkspace, validateKey } from "../../../libs/middlewares/auth";
import {
  MISSING_CREDENTIALS_MESSAGE,
  extractCredential,
} from "../../../libs/middlewares/credentials";
import { RPC_CONTEXT_KEY, type RpcContext } from "./context";

export { RPC_CONTEXT_KEY, type RpcContext, getRpcContext } from "./context";

/**
 * Authentication interceptor for ConnectRPC.
 * Validates `x-openstatus-key` or a bearer token and sets workspace context.
 * Skips authentication for HealthService endpoints.
 */
export function authInterceptor(): Interceptor {
  return (next) => async (req) => {
    // Skip auth for HealthService
    if (req.service.typeName === "openstatus.health.v1.HealthService") {
      return next(req);
    }

    const credential = extractCredential(req.header);

    if (!credential) {
      throw rpcError({
        code: Code.Unauthenticated,
        reason: ErrorReason.MISSING_CREDENTIALS,
        message: MISSING_CREDENTIALS_MESSAGE,
      });
    }

    const { error, result } = await validateKey(credential.token);

    if (error) {
      throw rpcError({
        code: Code.Unauthenticated,
        reason: ErrorReason.INVALID_API_KEY,
        message: error.message,
      });
    }

    if (!result.valid || !result.ownerId) {
      throw rpcError({
        code: Code.Unauthenticated,
        reason: ErrorReason.INVALID_API_KEY,
        message: "Invalid API Key",
      });
    }

    const ownerId = Number.parseInt(result.ownerId);

    if (Number.isNaN(ownerId)) {
      throw rpcError({
        code: Code.Unauthenticated,
        reason: ErrorReason.INVALID_API_KEY,
        message: "Invalid API Key format",
      });
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
