import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";

import { handleError } from "@/libs/errors";
import { authMiddleware } from "@/libs/middlewares/auth";
import type { Variables } from "@/types";

import { toServiceCtx } from "./adapter";
import { createMcpServer } from "./server";

export const mcpRoute = new Hono<{ Variables: Variables }>({ strict: false });

// Match production's global error handler at the sub-router level so
// `OpenStatusApiError` (thrown by `authMiddleware` on bad/missing
// keys) translates to the right HTTP status whether or not the parent
// app has its own `onError` wired up. This makes the route portable
// across mount points and self-contained for tests.
mcpRoute.onError(handleError);

mcpRoute.use("*", authMiddleware);

/**
 * The transport handler MUST return a JSON-RPC error envelope on
 * unexpected throws — Hono's default `app.onError(handleError)` returns
 * the openstatus HTTP error shape, which MCP clients can't parse and
 * will treat as a transport disconnect. Auth failures (thrown before
 * we reach the transport) still flow to the global error handler and
 * surface as HTTP 401, which is correct.
 */
mcpRoute.all("/", async (c) => {
  const workspace = c.get("workspace");
  const requestId = c.get("requestId");
  const apiKey = c.get("apiKey");
  const ctx = toServiceCtx({
    workspace,
    apiKey,
    requestId,
  });

  // Stateless mode: a fresh `McpServer` + transport per request. Both
  // are local to this scope and become garbage-collectable once the
  // returned Response stream is consumed by Hono. We deliberately do
  // NOT call `server.close()` in a `finally` — closing tears down the
  // SSE stream before Hono finishes writing the body, sending an
  // empty response to the client.
  const server = createMcpServer(ctx);
  const transport = new StreamableHTTPTransport();
  try {
    await server.connect(transport);
    return await transport.handleRequest(c);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return c.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32603, message },
      },
      { status: 200 },
    );
  }
});
