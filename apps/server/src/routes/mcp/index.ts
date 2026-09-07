import { StreamableHTTPTransport } from "@hono/mcp";
import { getLogger } from "@logtape/logtape";
import { Events, setupAnalytics } from "@openstatus/analytics";
import type { Workspace } from "@openstatus/db/src/schema";
import { resourceMetadataUrl } from "@openstatus/services/oauth";
import { Hono } from "hono";
import type { Context, Next } from "hono";

import { handleError } from "../../libs/errors";
import { authMiddleware } from "../../libs/middlewares/auth";
import type { Variables } from "../../types";
import { oauthConfigFromEnv } from "../oauth/config";
import { toServiceCtx } from "./adapter";
import { createMcpServer, createPublicMcpServer } from "./server";

const logger = getLogger("api-server");

export const mcpRoute = new Hono<{ Variables: Variables }>({ strict: false });

const wwwAuthenticate = `Bearer resource_metadata="${resourceMetadataUrl(oauthConfigFromEnv().issuer)}"`;

// Match production's global error handler at the sub-router level so
// `OpenStatusApiError` (thrown by `authMiddleware` on bad/missing
// keys) translates to the right HTTP status whether or not the parent
// app has its own `onError` wired up. This makes the route portable
// across mount points and self-contained for tests.
// A 401 also carries `WWW-Authenticate` (RFC 9728) so OAuth clients can
// start discovery; the envelope body stays for header-based callers.
mcpRoute.onError((err, c) => {
  const res = handleError(err, c);
  if (res.status === 401) res.headers.set("WWW-Authenticate", wwwAuthenticate);
  return res;
});

/**
 * An MCP client `initialize`s before it has a credential, and a handshake that
 * 401s reads as an unreachable server rather than a protected one. A missing
 * key drops the request to the public surface (documents only, no tools); a
 * key that is present but invalid is still a 401, so a misconfigured client
 * gets told so instead of silently losing its workspace.
 */
async function optionalAuthMiddleware(
  c: Context<{ Variables: Variables }, "/*">,
  next: Next,
) {
  // `=== undefined` rather than a truthiness check: a client that sends the
  // header with an empty value is misconfigured, not anonymous, and should be
  // told so instead of silently dropping to the public surface.
  // A bearer token is a credential too; it must be validated, never treated
  // as anonymous.
  if (
    c.req.header("x-openstatus-key") === undefined &&
    c.req.header("authorization") === undefined
  ) {
    return next();
  }
  return authMiddleware(c, next);
}

mcpRoute.use("*", optionalAuthMiddleware);

/**
 * The JSON-RPC calls carried by a request body, as OpenPanel event properties.
 * A batch arrives as an array and every entry is its own call; `params.name` is
 * the tool for `tools/call`, `params.uri` the document for `resources/read`.
 */
function rpcCalls(body: unknown): Record<string, unknown>[] {
  const entries = Array.isArray(body) ? body : [body];
  const calls: Record<string, unknown>[] = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    const { method, params } = entry as { method?: unknown; params?: unknown };
    if (typeof method !== "string") continue;
    const { name, uri } = (params ?? {}) as { name?: unknown; uri?: unknown };
    calls.push({
      method,
      ...(typeof name === "string" ? { tool: name } : {}),
      ...(typeof uri === "string" ? { uri } : {}),
    });
  }
  return calls;
}

/**
 * Fire-and-forget OpenPanel event for every JSON-RPC call that reaches the
 * transport, so MCP traffic is countable alongside the REST and RPC surfaces.
 * Emitted before execution: this measures calls, not successes, so a tool that
 * throws still shows up in the volume.
 *
 * Authenticated requests reuse the `api_<workspaceId>` profile the RPC tracking
 * interceptor writes to — one identity per workspace across both programmatic
 * surfaces, with the `mcp` channel telling them apart. Anonymous requests (an
 * `initialize` before the client has a credential, or a public `resources/read`)
 * carry no profile: `setupAnalytics` skips `identify` without a `userId` and the
 * event still lands, marked `authenticated: false`.
 */
function trackMcpRequest(
  c: Context<{ Variables: Variables }, "/*">,
  workspace: Workspace | undefined,
  body: unknown,
) {
  const calls = rpcCalls(body);
  if (calls.length === 0) return;

  setupAnalytics({
    userId: workspace ? `api_${workspace.id}` : undefined,
    workspaceId: workspace ? `${workspace.id}` : undefined,
    plan: workspace?.plan,
    location: c.req.header("x-forwarded-for"),
    userAgent: c.req.header("user-agent"),
  })
    .then((analytics) =>
      Promise.all(
        calls.map((call) =>
          analytics.track({
            ...Events.McpRequest,
            ...call,
            authenticated: workspace !== undefined,
          }),
        ),
      ),
    )
    .catch(() => {
      logger.warn("Failed to send MCP analytics event for {methods}", {
        methods: calls.map((call) => call.method),
      });
    });
}

/**
 * The transport handler MUST return a JSON-RPC error envelope on
 * unexpected throws — Hono's default `app.onError(handleError)` returns
 * the openstatus HTTP error shape, which MCP clients can't parse and
 * will treat as a transport disconnect. Auth failures (thrown before
 * we reach the transport) still flow to the global error handler and
 * surface as HTTP 401, which is correct.
 */
mcpRoute.all("/", async (c) => {
  // Anonymous requests reach here with `workspace` unset, which `Variables`
  // (shared with the authenticated V1 surface) cannot express.
  const workspace = c.get("workspace") as Workspace | undefined;
  const requestId = c.get("requestId");

  // Pre-parse the JSON-RPC body so we can mirror the request `id` on
  // any error envelope we synthesize below. Per JSON-RPC 2.0 the
  // response `id` MUST equal the request `id` when known; `null` is
  // only correct for un-parseable requests. Reading the body here also
  // means we can pass it as `parsedBody` to the transport, avoiding a
  // double-parse downstream.
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
      // Malformed body — leave `parsedBody` undefined; the transport
      // will produce its own ParseError JSON-RPC envelope.
    }
  }

  trackMcpRequest(c, workspace, parsedBody);

  // Stateless mode: a fresh `McpServer` + transport per request. Both
  // are local to this scope and become garbage-collectable once the
  // returned Response stream is consumed by Hono. We deliberately do
  // NOT call `server.close()` in a `finally` — closing tears down the
  // SSE stream before Hono finishes writing the body, sending an
  // empty response to the client.
  const server = workspace
    ? createMcpServer(
        toServiceCtx({ workspace, apiKey: c.get("apiKey"), requestId }),
      )
    : createPublicMcpServer();
  const transport = new StreamableHTTPTransport();
  try {
    await server.connect(transport);
    return await transport.handleRequest(c, parsedBody);
  } catch (err) {
    // HTTP 200 + JSON-RPC error envelope is intentional. JSON-RPC 2.0
    // expresses application-level errors *inside* the response body
    // (the `error` field), with the transport HTTP status reserved
    // for transport-level failures. Auth failures throw earlier and
    // surface as HTTP 401 via `mcpRoute.onError(handleError)`.
    const message = err instanceof Error ? err.message : "Internal error";
    return c.json(
      {
        jsonrpc: "2.0",
        id: requestRpcId,
        error: { code: -32603, message },
      },
      { status: 200 },
    );
  }
});
