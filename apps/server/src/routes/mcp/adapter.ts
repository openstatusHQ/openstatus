import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Workspace } from "@openstatus/db/src/schema";
import { type ServiceContext, ServiceError } from "@openstatus/services";
import { ZodError } from "zod";

/**
 * Build a `ServiceContext` for an MCP-originated request.
 *
 * `apiKey.id` is the real key identifier captured by the auth
 * middleware — audit rows read it via `actor.keyId` so mutations
 * attribute to the specific key, not the workspace.
 * `apiKey.createdById` is the openstatus user who created the API key
 * (custom keys only); propagated to `actor.userId` so
 * `audit_log.actor_user_id` is populated.
 *
 * `actor.type` is `"mcp"` (not `"apiKey"`) so audit logs can be sliced
 * by transport surface without leaning on side-channel metadata.
 */
export function toServiceCtx(args: {
  workspace: Workspace;
  apiKey: { id: string; createdById?: number };
  requestId?: string;
}): ServiceContext {
  return {
    workspace: args.workspace,
    actor: {
      type: "mcp",
      keyId: args.apiKey.id,
      userId: args.apiKey.createdById,
    },
    requestId: args.requestId,
  };
}

/**
 * Convert any error from a tool's `execute` body into either a
 * recoverable `CallToolResult` (so the LLM can retry with corrected
 * input) or a thrown `McpError` (so the JSON-RPC envelope surfaces a
 * transport-level failure). Mirrors the discrimination in
 * `apps/server/src/routes/rpc/adapter.ts`.
 */
export function mapError(err: unknown): CallToolResult {
  // ZodError surfaces from a service's `Input.parse(args.input)` —
  // either a type mismatch the LLM passed or a refine() failure
  // (e.g. `from > to` on `CreateMaintenanceInput`). Both are
  // recoverable: the LLM can read the message and retry. Treated
  // the same as `ServiceError.VALIDATION`.
  if (err instanceof ZodError) {
    return {
      isError: true,
      content: [{ type: "text", text: `Invalid input: ${err.message}` }],
    };
  }
  if (err instanceof ServiceError) {
    switch (err.code) {
      case "NOT_FOUND":
      case "VALIDATION":
      case "CONFLICT":
      case "LIMIT_EXCEEDED":
        return {
          isError: true,
          content: [{ type: "text", text: err.message }],
        };
      case "UNAUTHORIZED":
      case "FORBIDDEN":
      case "INTERNAL":
      case "PRECONDITION_FAILED":
        throw new McpError(serviceErrorToMcpCode(err.code), err.message);
    }
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  throw new McpError(ErrorCode.InternalError, message);
}

function serviceErrorToMcpCode(
  code: "UNAUTHORIZED" | "FORBIDDEN" | "INTERNAL" | "PRECONDITION_FAILED",
): ErrorCode {
  switch (code) {
    case "UNAUTHORIZED":
    case "FORBIDDEN":
      // MCP has no dedicated auth code — InvalidRequest is the closest fit
      // and matches what other MCP servers return for permission failures.
      return ErrorCode.InvalidRequest;
    case "PRECONDITION_FAILED":
      return ErrorCode.InvalidRequest;
    case "INTERNAL":
      return ErrorCode.InternalError;
  }
}

/**
 * Run a tool body through the error mapper. The unrecoverable branch
 * throws synchronously inside `mapError`, so the outer `try` catches it
 * and re-throws to the SDK; recoverable errors return a `CallToolResult`
 * that the SDK forwards as the tool's response.
 */
export async function runTool<T>(
  fn: () => Promise<T>,
  toContent: (value: T) => CallToolResult,
): Promise<CallToolResult> {
  try {
    const value = await fn();
    return toContent(value);
  } catch (err) {
    return mapError(err);
  }
}
