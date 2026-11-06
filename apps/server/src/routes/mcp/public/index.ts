import { StreamableHTTPTransport } from "@hono/mcp";
import { Events, setupAnalytics } from "@openstatus/analytics";
import { Hono } from "hono";
import type { Context } from "hono";

import { rpcCalls } from "../analytics";
import { createPublicStatusMcpServer } from "./server";

const BROWSER_REDIRECT = "https://www.openstatus.dev/status";

/**
 * Anonymous MCP endpoint for third-party status. Unlike `/mcp` it answers
 * without a credential on purpose: there is no workspace data behind it, and
 * "add one URL, no login" is the point. Mounted ahead of `/mcp`, whose auth
 * middleware would otherwise claim this path.
 */
export const publicStatusMcpRoute = new Hono({ strict: false });

function trackPublicMcpRequest(c: Context, body: unknown) {
  const calls = rpcCalls(body);
  if (calls.length === 0) return;
  setupAnalytics({
    source: "mcp",
    location: c.req.header("x-forwarded-for"),
    userAgent: c.req.header("user-agent"),
  })
    .then((analytics) =>
      Promise.all(
        calls.map((call) =>
          analytics.track({
            ...Events.McpRequest,
            ...call,
            authenticated: false,
            endpoint: "status",
          }),
        ),
      ),
    )
    .catch(() => {});
}

publicStatusMcpRoute.all("/", async (c) => {
  // A person opening the URL gets the human page, not a JSON-RPC error.
  if (
    c.req.method === "GET" &&
    (c.req.header("accept") ?? "").includes("text/html")
  ) {
    return c.redirect(BROWSER_REDIRECT, 302);
  }

  let parsedBody: unknown;
  let requestRpcId: string | number | null = null;
  if (c.req.method === "POST") {
    try {
      parsedBody = await c.req.json();
      const idCandidate = (parsedBody as { id?: unknown } | null)?.id;
      if (typeof idCandidate === "string" || typeof idCandidate === "number") {
        requestRpcId = idCandidate;
      }
    } catch {
      // The transport answers a malformed body with its own ParseError.
    }
  }

  trackPublicMcpRequest(c, parsedBody);

  const server = createPublicStatusMcpServer();
  const transport = new StreamableHTTPTransport();
  try {
    await server.connect(transport);
    return await transport.handleRequest(c, parsedBody);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return c.json(
      {
        jsonrpc: "2.0",
        id: requestRpcId,
        error: { code: -32603, message },
      },
      200,
    );
  }
});
