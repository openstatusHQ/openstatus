import { createConnectRouter } from "@connectrpc/connect";
import {
  universalServerRequestFromFetch,
  universalServerResponseToFetch,
} from "@connectrpc/connect/protocol";
import type { Hono } from "hono";

import { HealthService } from "@openstatus/proto/health/v1";
import { MonitorService } from "@openstatus/proto/monitor/v1";

import { healthServiceImpl } from "./handlers/health";
import { monitorServiceImpl } from "./handlers/monitor";
import {
  authInterceptor,
  errorInterceptor,
  loggingInterceptor,
} from "./interceptors";

/**
 * Create ConnectRPC router with services.
 * Interceptors are applied in order (outermost to innermost):
 * 1. errorInterceptor - Catches all errors and maps to ConnectError
 * 2. loggingInterceptor - Logs requests/responses with duration
 * 3. authInterceptor - Validates API key and sets workspace context
 */
export const routes = createConnectRouter({
  interceptors: [errorInterceptor(), loggingInterceptor(), authInterceptor()],
})
  .service(MonitorService, monitorServiceImpl)
  .service(HealthService, healthServiceImpl);

/**
 * Mount ConnectRPC routes on a Hono app at /rpc prefix.
 *
 * @param app - The Hono app instance
 */
export function mountRpcRoutes(app: Hono) {
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
