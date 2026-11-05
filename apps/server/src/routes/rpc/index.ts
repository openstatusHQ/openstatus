import { Code, ConnectError } from "@connectrpc/connect";
import {
  universalServerRequestFromFetch,
  universalServerResponseToFetch,
} from "@connectrpc/connect/protocol";
import { errorFromJson } from "@connectrpc/connect/protocol-connect";
import type { Hono } from "hono";

import { connectErrorToJson, rpcError, withErrorInfo } from "@/libs/errors/rpc";
import { getRequestId } from "@/libs/request-id";

import { routes } from "./router";

// Re-export for external use
export { routes } from "./router";
export { getRpcContext } from "./interceptors";
export type { RpcContext } from "./interceptors";

/**
 * Mount ConnectRPC routes on a Hono app at /rpc prefix.
 *
 * @param app - The Hono app instance
 */
export function mountRpcRoutes(
  app: Hono<{
    Variables: {
      event: Record<string, unknown>;
    };
  }>,
) {
  // Handle all RPC routes at /rpc/* prefix
  app.all("/rpc/*", async (c) => {
    const url = new URL(c.req.url);
    // Remove the /rpc prefix from the path for matching
    const pathWithoutPrefix = url.pathname.replace(/^\/rpc/, "");
    const requestId = getRequestId(c);

    // Find the handler that matches this request
    const handler = routes.handlers.find(
      (h) => h.requestPath === pathWithoutPrefix,
    );

    if (!handler) {
      const err = rpcError({
        code: Code.NotFound,
        reason: "NOT_FOUND",
        message: "Not found",
      });
      return c.json(connectErrorToJson(withErrorInfo(err, requestId)), 404);
    }

    // Check if the HTTP method is allowed
    if (!handler.allowedMethods.includes(c.req.method)) {
      const err = rpcError({
        code: Code.Unimplemented,
        reason: "METHOD_NOT_ALLOWED",
        message: "Method not allowed",
      });
      return c.json(connectErrorToJson(withErrorInfo(err, requestId)), 405);
    }

    // Hono already minted (or accepted) the request id; hand the same one to
    // the interceptors so the client, the wide event and the RPC log agree.
    const headers = new Headers(c.req.raw.headers);
    if (requestId) headers.set("x-request-id", requestId);
    const universalRequest = universalServerRequestFromFetch(
      new Request(c.req.raw, { headers }),
      {},
    );

    // Call the handler
    const universalResponse = await handler(universalRequest);

    // A raw Response skips Hono's prepared headers, so echo the id ourselves.
    const res = universalServerResponseToFetch(universalResponse);
    if (requestId) res.headers.set("x-request-id", requestId);
    return withErrorInfoBody(res, requestId);
  });
}

/**
 * Connect rejects undecodable bodies and bad protocol headers before any
 * interceptor runs, so those errors reach the wire without ErrorInfo.
 */
async function withErrorInfoBody(
  res: Response,
  requestId: string | undefined,
): Promise<Response> {
  if (
    res.status < 400 ||
    !res.headers.get("content-type")?.startsWith("application/json")
  ) {
    return res;
  }
  const body = await res
    .clone()
    .json()
    .catch(() => undefined);
  if (
    !body ||
    body.details?.some(
      (d: { type?: string }) => d.type === "google.rpc.ErrorInfo",
    )
  ) {
    return res;
  }
  const err = errorFromJson(
    body,
    res.headers,
    new ConnectError("unparseable", Code.Unknown),
  );
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(
    JSON.stringify(connectErrorToJson(withErrorInfo(err, requestId))),
    { status: res.status, headers },
  );
}
