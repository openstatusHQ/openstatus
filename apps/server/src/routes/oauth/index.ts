import { getLogger } from "@logtape/logtape";
import { ServiceError } from "@openstatus/services";
import {
  GRANT_TYPES,
  OAuthError,
  authorizationServerMetadata,
  createSession,
  exchangeCode,
  mcpResource,
  protectedResourceMetadata,
  refreshGrant,
  registerClient,
  revokeToken,
} from "@openstatus/services/oauth";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";

import type { OAuthConfig } from "./config";

const logger = getLogger("api-server");

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

type Body = Record<string, string | undefined>;

/** Token and revoke accept form-encoded (RFC 6749) and JSON bodies. */
async function readBody(c: Context): Promise<Body> {
  const contentType = c.req.header("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const json: unknown = await c.req.json();
      if (!json || typeof json !== "object" || Array.isArray(json)) {
        throw new OAuthError("invalid_request", "Body must be a JSON object");
      }
      const body: Body = {};
      for (const [k, v] of Object.entries(json)) {
        if (typeof v === "string") body[k] = v;
      }
      return body;
    }
    const form = await c.req.parseBody();
    const body: Body = {};
    for (const [k, v] of Object.entries(form)) {
      if (typeof v === "string") body[k] = v;
    }
    return body;
  } catch (err) {
    if (err instanceof OAuthError) throw err;
    throw new OAuthError("invalid_request", "Malformed request body");
  }
}

function require(body: Body, name: string): string {
  const value = body[name];
  if (!value) throw new OAuthError("invalid_request", `${name} is required`);
  return value;
}

/**
 * RFC 6749 error bodies, never the openstatus envelope: MCP clients treat
 * anything else as a transport failure. Authorize-time errors with a valid
 * redirect target go back to the client via the redirect.
 */
function handleOAuthError(err: Error, c: Context): Response {
  if (err instanceof OAuthError) {
    if (err.redirectUri) {
      const url = new URL(err.redirectUri);
      url.searchParams.set("error", err.oauthCode);
      url.searchParams.set("error_description", err.message);
      if (err.state !== undefined) url.searchParams.set("state", err.state);
      return c.redirect(url.toString(), 302);
    }
    // 401 is the token/revoke contract; an authorize-time unknown client is
    // shown to the resource owner as a plain 400.
    const clientAuthEndpoint = /\/oauth\/(token|revoke)$/.test(c.req.path);
    return c.json(
      { error: err.oauthCode, error_description: err.message },
      err.oauthCode === "invalid_client" && clientAuthEndpoint ? 401 : 400,
      NO_STORE,
    );
  }
  if (err instanceof ZodError) {
    return c.json(
      { error: "invalid_request", error_description: err.message },
      400,
      NO_STORE,
    );
  }
  if (err instanceof ServiceError) {
    switch (err.code) {
      case "UNAUTHORIZED":
        return c.json(
          { error: "invalid_client", error_description: err.message },
          401,
          NO_STORE,
        );
      case "FORBIDDEN":
        return c.json(
          { error: "access_denied", error_description: err.message },
          400,
          NO_STORE,
        );
      case "NOT_FOUND":
      case "VALIDATION":
      case "CONFLICT":
      case "PRECONDITION_FAILED":
      case "LIMIT_EXCEEDED":
        return c.json(
          { error: "invalid_request", error_description: err.message },
          400,
          NO_STORE,
        );
      case "INTERNAL":
        break;
    }
  }
  logger.error("OAuth route error", {
    error: { name: err.name, message: err.message, stack: err.stack },
    method: c.req.method,
    url: c.req.url,
  });
  return c.json(
    { error: "server_error", error_description: "Something went wrong" },
    500,
    NO_STORE,
  );
}

export function createOAuthRoutes(config: OAuthConfig) {
  const app = new Hono({ strict: false });
  const resource = mcpResource(config.issuer);

  // Browser-based MCP clients fetch metadata and tokens cross-origin. Scoped
  // to these paths: the sub-app mounts at "/", so "*" would cover every route.
  const oauthCors = cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "mcp-protocol-version"],
    maxAge: 86400,
  });
  app.use("/.well-known/*", oauthCors);
  app.use("/oauth/*", oauthCors);
  app.onError(handleOAuthError);

  // RFC 8414
  app.get("/.well-known/oauth-authorization-server", (c) =>
    c.json(authorizationServerMetadata(config.issuer)),
  );

  // RFC 9728, path-suffixed for the `/mcp` resource.
  app.get("/.well-known/oauth-protected-resource/mcp", (c) =>
    c.json(protectedResourceMetadata(config.issuer)),
  );

  // RFC 7591
  app.post("/oauth/register", async (c) => {
    const json: unknown = await c.req.json().catch(() => null);
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new OAuthError(
        "invalid_client_metadata",
        "Body must be a JSON object",
      );
    }
    const client = await registerClient({
      input: json as Parameters<typeof registerClient>[0]["input"],
    });
    return c.json(client, 201, NO_STORE);
  });

  app.get("/oauth/authorize", async (c) => {
    const { id } = await createSession({
      input: { ...c.req.query(), expectedResource: resource },
      fetchClientMetadata: config.fetchClientMetadata,
    });
    const consent = new URL("/oauth/consent", config.dashboardUrl);
    consent.searchParams.set("session", id);
    return c.redirect(consent.toString(), 302);
  });

  app.post("/oauth/token", async (c) => {
    const body = await readBody(c);
    const grantType = require(body, "grant_type");
    const clientId = require(body, "client_id");

    switch (grantType) {
      case "authorization_code": {
        const tokens = await exchangeCode({
          input: {
            clientId,
            code: require(body, "code"),
            codeVerifier: require(body, "code_verifier"),
            redirectUri: require(body, "redirect_uri"),
          },
        });
        return c.json(tokens, 200, NO_STORE);
      }
      case "refresh_token": {
        const tokens = await refreshGrant({
          input: { clientId, refreshToken: require(body, "refresh_token") },
        });
        return c.json(tokens, 200, NO_STORE);
      }
      default:
        throw new OAuthError(
          "unsupported_grant_type",
          `grant_type must be one of ${GRANT_TYPES.join(", ")}`,
        );
    }
  });

  // RFC 7009: 200 whether or not the token was known.
  app.post("/oauth/revoke", async (c) => {
    const body = await readBody(c);
    await revokeToken({
      input: {
        clientId: require(body, "client_id"),
        token: require(body, "token"),
      },
    });
    return c.body(null, 200, NO_STORE);
  });

  return app;
}
