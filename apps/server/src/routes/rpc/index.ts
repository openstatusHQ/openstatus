import {
  universalServerRequestFromFetch,
  universalServerResponseToFetch,
} from "@connectrpc/connect/protocol";
import type { Hono } from "hono";

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

    // Find the handler that matches this request
    const handler = routes.handlers.find(
      (h) => h.requestPath === pathWithoutPrefix,
    );

    if (!handler) {
      return c.json({ error: "Not found" }, 404);
    }

    // Check if the HTTP method is allowed
    if (!handler.allowedMethods.includes(c.req.method)) {
      return c.json({ error: "Method not allowed" }, 405);
    }

    // Convert fetch Request to universal request
    const universalRequest = universalServerRequestFromFetch(c.req.raw, {});

    // Call the handler
    const universalResponse = await handler(universalRequest);

    // Convert universal response back to fetch Response
    return universalServerResponseToFetch(universalResponse);
  });
}
