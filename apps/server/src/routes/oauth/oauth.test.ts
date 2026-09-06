import { db, eq, inArray } from "@openstatus/db";
import {
  oauthAuthorizationCode,
  oauthClient,
  oauthGrant,
  oauthSession,
} from "@openstatus/db/src/schema";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import {
  OAuthError,
  decideSession,
  parseClientMetadataDocument,
  pkceChallenge,
} from "@openstatus/services/oauth";
import { clearAuditLogFor } from "@openstatus/services/test/helpers";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";
import { Hono } from "hono";

import { app } from "../../index";
import { oauthConfigFromEnv } from "./config";
import * as routes from "./index";

const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const REDIRECT = "http://127.0.0.1:43111/callback";
const config = oauthConfigFromEnv();

let workspaceId: number;
let userId: number;
const clientIds: string[] = [];

beforeAll(async () => {
  const fixture = await createTestWorkspace({ plan: "team" });
  workspaceId = fixture.workspace.id;
  userId = fixture.user.id;
});

afterAll(async () => {
  if (clientIds.length === 0) return;
  const grants = await db
    .select({ id: oauthGrant.id })
    .from(oauthGrant)
    .where(inArray(oauthGrant.clientId, clientIds))
    .all();
  await clearAuditLogFor({
    entityType: "oauth_grant",
    entityIds: grants.map((g) => g.id),
  });
  await db.delete(oauthGrant).where(inArray(oauthGrant.clientId, clientIds));
  await db
    .delete(oauthAuthorizationCode)
    .where(inArray(oauthAuthorizationCode.clientId, clientIds));
  await db
    .delete(oauthSession)
    .where(inArray(oauthSession.clientId, clientIds));
  await db.delete(oauthClient).where(inArray(oauthClient.clientId, clientIds));
});

function json(path: string, body: unknown, init: RequestInit = {}) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
}

function form(path: string, fields: Record<string, string>) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

async function registerClient(name = "Test MCP Client"): Promise<string> {
  const res = await json("/oauth/register", {
    client_name: name,
    redirect_uris: [REDIRECT],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  clientIds.push(body.client_id);
  return body.client_id;
}

async function authorize(clientId: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    scope: "read write",
    state: "s-1",
    code_challenge: await pkceChallenge(VERIFIER),
    code_challenge_method: "S256",
    ...extra,
  });
  return app.request(`/oauth/authorize?${params.toString()}`, {
    redirect: "manual",
  });
}

/** Dashboard consent, driven through the service the tRPC router wraps. */
async function consent(sessionId: string, scope?: ("read" | "write")[]) {
  const { redirectUrl } = await decideSession({
    input: { id: sessionId, approved: true, userId, workspaceId, scope },
  });
  const code = new URL(redirectUrl).searchParams.get("code");
  if (!code) throw new Error("no code");
  return code;
}

async function sessionIdFromAuthorize(clientId: string): Promise<string> {
  const res = await authorize(clientId);
  expect(res.status).toBe(302);
  const location = new URL(res.headers.get("location") ?? "");
  expect(location.origin).toBe(new URL(config.dashboardUrl).origin);
  expect(location.pathname).toBe("/oauth/consent");
  const id = location.searchParams.get("session");
  if (!id) throw new Error("consent redirect carries no session id");
  return id;
}

async function mintTokens(clientId: string, scope?: ("read" | "write")[]) {
  const sessionId = await sessionIdFromAuthorize(clientId);
  const code = await consent(sessionId, scope);
  const res = await form("/oauth/token", {
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    code_verifier: VERIFIER,
    redirect_uri: REDIRECT,
  });
  expect(res.status).toBe(200);
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
  }>;
}

function mcp(headers: Record<string, string> = {}) {
  return app.request("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
}

async function toolNames(res: Response): Promise<string[]> {
  const text = await res.text();
  const match = text.match(/data:\s*({.*})/);
  if (!match) throw new Error(`no data frame in SSE response: ${text}`);
  const body = JSON.parse(match[1]) as {
    result?: { tools: { name: string }[] };
  };
  return (body.result?.tools ?? []).map((t) => t.name).sort();
}

function rpc(headers: Record<string, string> = {}) {
  return app.request("/rpc/openstatus.monitor.v1.MonitorService/ListMonitors", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({}),
  });
}

describe("well-known metadata", () => {
  test("authorization server metadata (RFC 8414)", async () => {
    const res = await app.request("/.well-known/oauth-authorization-server");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      issuer: config.issuer,
      authorization_endpoint: `${config.issuer}/oauth/authorize`,
      token_endpoint: `${config.issuer}/oauth/token`,
      registration_endpoint: `${config.issuer}/oauth/register`,
      revocation_endpoint: `${config.issuer}/oauth/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["read", "write"],
    });
  });

  test("protected resource metadata for /mcp (RFC 9728)", async () => {
    const res = await app.request("/.well-known/oauth-protected-resource/mcp");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      resource: `${config.issuer}/mcp`,
      authorization_servers: [config.issuer],
      bearer_methods_supported: ["header"],
      scopes_supported: ["read", "write"],
    });
  });

  test("answers CORS preflight", async () => {
    const res = await app.request("/oauth/token", {
      method: "OPTIONS",
      headers: {
        Origin: "https://claude.ai",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  test("does not leak the wildcard CORS policy onto other routes", async () => {
    const res = await app.request("/ping", {
      headers: { Origin: "https://claude.ai" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("POST /oauth/register", () => {
  test("registers a public client", async () => {
    const res = await json("/oauth/register", {
      client_name: "Claude",
      redirect_uris: [REDIRECT],
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    clientIds.push(body.client_id);
    expect(body).toMatchObject({
      client_name: "Claude",
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    });
    expect(body.client_id).toMatch(/^[a-f0-9]{32}$/);
    expect(body.client_secret).toBeUndefined();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  test("rejects off-allowlist redirect URIs with an RFC 7591 error body", async () => {
    const res = await json("/oauth/register", {
      redirect_uris: ["https://attacker.example/cb"],
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_redirect_uri");
    expect(typeof body.error_description).toBe("string");
    expect(body.code).toBeUndefined();
  });

  test("rejects non-object bodies and confidential clients", async () => {
    expect((await json("/oauth/register", ["x"])).status).toBe(400);
    const res = await json("/oauth/register", {
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: "client_secret_basic",
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_client_metadata");
  });
});

describe("GET /oauth/authorize", () => {
  test("stores a session and redirects to the dashboard consent page", async () => {
    const clientId = await registerClient();
    const id = await sessionIdFromAuthorize(clientId);
    const row = await db
      .select()
      .from(oauthSession)
      .where(eq(oauthSession.id, id))
      .get();
    expect(row?.clientId).toBe(clientId);
    expect(row?.scope).toEqual(["write"]);
    expect(row?.state).toBe("s-1");
  });

  test("unknown client or wrong redirect_uri is a 400, not a redirect", async () => {
    const clientId = await registerClient();
    const unknown = await authorize("0000", {});
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).error).toBe("invalid_client");

    const mismatch = await authorize(clientId, {
      redirect_uri: "http://127.0.0.1:43111/elsewhere",
    });
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).error).toBe("invalid_redirect_uri");
  });

  test("missing PKCE redirects back to the client with error and state", async () => {
    const clientId = await registerClient();
    const res = await authorize(clientId, { code_challenge: "" });
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("location") ?? "");
    expect(`${url.origin}${url.pathname}`).toBe(REDIRECT);
    expect(url.searchParams.get("error")).toBe("invalid_request");
    expect(url.searchParams.get("state")).toBe("s-1");
  });

  test("a resource parameter must name the MCP endpoint", async () => {
    const clientId = await registerClient();
    const bad = await authorize(clientId, {
      resource: "https://other.example/mcp",
    });
    expect(bad.status).toBe(302);
    expect(
      new URL(bad.headers.get("location") ?? "").searchParams.get("error"),
    ).toBe("invalid_target");
    const good = await authorize(clientId, {
      resource: `${config.issuer}/mcp`,
    });
    expect(new URL(good.headers.get("location") ?? "").pathname).toBe(
      "/oauth/consent",
    );
  });
});

describe("POST /oauth/token", () => {
  test("authorization_code with a form body returns a bearer pair", async () => {
    const clientId = await registerClient();
    const tokens = await mintTokens(clientId);
    expect(tokens.token_type).toBe("bearer");
    expect(tokens.expires_in).toBe(3600);
    expect(tokens.scope).toBe("write");
    expect(tokens.access_token).toMatch(/^os_oat_/);
  });

  test("authorization_code with a JSON body and a narrowed scope", async () => {
    const clientId = await registerClient();
    const sessionId = await sessionIdFromAuthorize(clientId);
    const code = await consent(sessionId, ["read"]);
    const res = await json("/oauth/token", {
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: VERIFIER,
      redirect_uri: REDIRECT,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.json()).scope).toBe("read");
  });

  test("wrong verifier, replayed code and unsupported grant types answer RFC 6749 errors", async () => {
    const clientId = await registerClient();
    const sessionId = await sessionIdFromAuthorize(clientId);
    const code = await consent(sessionId);
    const base = {
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: REDIRECT,
    };

    const bad = await form("/oauth/token", {
      ...base,
      code_verifier: `${VERIFIER.slice(0, -1)}A`,
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("invalid_grant");

    const ok = await form("/oauth/token", { ...base, code_verifier: VERIFIER });
    expect(ok.status).toBe(200);
    const tokens = await ok.json();

    const replay = await form("/oauth/token", {
      ...base,
      code_verifier: VERIFIER,
    });
    expect(replay.status).toBe(400);
    expect((await replay.json()).error).toBe("invalid_grant");
    // replay revoked the grant it produced
    expect(
      (await mcp({ Authorization: `Bearer ${tokens.access_token}` })).status,
    ).toBe(401);

    const unsupported = await form("/oauth/token", {
      grant_type: "client_credentials",
      client_id: clientId,
    });
    expect(unsupported.status).toBe(400);
    expect((await unsupported.json()).error).toBe("unsupported_grant_type");

    const missing = await form("/oauth/token", {
      grant_type: "authorization_code",
    });
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("invalid_request");

    const unknownClient = await form("/oauth/token", {
      ...base,
      client_id: "nope",
      code_verifier: VERIFIER,
    });
    expect(unknownClient.status).toBe(401);
    expect((await unknownClient.json()).error).toBe("invalid_client");
  });

  test("refresh_token rotates the pair and retires the old access token", async () => {
    const clientId = await registerClient();
    const first = await mintTokens(clientId);
    expect(
      (await mcp({ Authorization: `Bearer ${first.access_token}` })).status,
    ).toBe(200);

    const res = await form("/oauth/token", {
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: first.refresh_token,
    });
    expect(res.status).toBe(200);
    const second = await res.json();
    expect(second.access_token).not.toBe(first.access_token);
    expect(second.refresh_token).not.toBe(first.refresh_token);
    expect(
      (await mcp({ Authorization: `Bearer ${first.access_token}` })).status,
    ).toBe(401);
    expect(
      (await mcp({ Authorization: `Bearer ${second.access_token}` })).status,
    ).toBe(200);

    const unknown = await form("/oauth/token", {
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: "nope",
    });
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).error).toBe("invalid_grant");
  });
});

describe("POST /oauth/revoke", () => {
  test("revokes by access token and always answers 200", async () => {
    const clientId = await registerClient();
    const tokens = await mintTokens(clientId);
    expect(
      (await mcp({ Authorization: `Bearer ${tokens.access_token}` })).status,
    ).toBe(200);

    const res = await form("/oauth/revoke", {
      client_id: clientId,
      token: tokens.access_token,
    });
    expect(res.status).toBe(200);
    expect(
      (await mcp({ Authorization: `Bearer ${tokens.access_token}` })).status,
    ).toBe(401);

    const again = await form("/oauth/revoke", {
      client_id: clientId,
      token: "unknown",
    });
    expect(again.status).toBe(200);
  });
});

describe("bearer tokens on the resource surfaces", () => {
  test("/mcp without any credential falls to the public surface", async () => {
    // Anonymous requests are served the public documents; OAuth discovery
    // therefore starts from the 401 an invalid or empty credential produces.
    const res = await mcp();
    expect(res.status).toBe(200);
    expect(await toolNames(res)).toEqual([]);
  });

  test("/mcp with an empty Authorization header is a 401 carrying WWW-Authenticate", async () => {
    const res = await mcp({ Authorization: "" });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="${config.issuer}/.well-known/oauth-protected-resource/mcp"`,
    );
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  test("/mcp rejects an invalid bearer token with the same header", async () => {
    const res = await mcp({ Authorization: "Bearer os_oat_bogus" });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("resource_metadata=");
  });

  test("/mcp lists tools for a valid bearer and filters by granted scope", async () => {
    const clientId = await registerClient();
    const write = await mintTokens(clientId);
    const writeRes = await mcp({
      Authorization: `Bearer ${write.access_token}`,
    });
    expect(writeRes.status).toBe(200);
    const writeTools = await toolNames(writeRes);
    expect(writeTools).toContain("list_monitors");
    expect(writeTools).toContain("create_status_report");

    const readOnly = await mintTokens(await registerClient("Read only"), [
      "read",
    ]);
    const readRes = await mcp({
      Authorization: `Bearer ${readOnly.access_token}`,
    });
    expect(readRes.status).toBe(200);
    const readTools = await toolNames(readRes);
    expect(readTools).toContain("list_monitors");
    expect(readTools).not.toContain("create_status_report");
  });

  test("x-openstatus-key still wins when both headers are present", async () => {
    const res = await mcp({
      "x-openstatus-key": String(workspaceId),
      Authorization: "Bearer os_oat_bogus",
    });
    expect(res.status).toBe(200);
  });

  test("/rpc accepts a bearer token and rejects a missing credential", async () => {
    const clientId = await registerClient();
    const tokens = await mintTokens(clientId);
    const ok = await rpc({ Authorization: `Bearer ${tokens.access_token}` });
    expect(ok.status).toBe(200);
    const missing = await rpc();
    expect(missing.status).toBe(401);
    expect(await missing.text()).toContain("credentials");
  });
});

describe("URL client ids (CIMD)", () => {
  const CIMD_ID = "https://partner.example/.well-known/oauth-client";
  const CIMD_REDIRECT = "https://partner.example/oauth/callback";

  function cimdApp(document: Record<string, unknown> | null) {
    const { createOAuthRoutes } = routes;
    const local = new Hono();
    local.route(
      "/",
      createOAuthRoutes({
        ...config,
        fetchClientMetadata: async (clientId) => {
          if (!document) {
            throw new OAuthError(
              "invalid_client",
              "Client metadata document responded with HTTP 404",
            );
          }
          return parseClientMetadataDocument(clientId, document);
        },
      }),
    );
    return local;
  }

  async function cimdAuthorize(
    local: Hono,
    extra: Record<string, string> = {},
  ) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: CIMD_ID,
      redirect_uri: CIMD_REDIRECT,
      scope: "read",
      state: "cimd",
      code_challenge: await pkceChallenge(VERIFIER),
      code_challenge_method: "S256",
      ...extra,
    });
    return local.request(`/oauth/authorize?${params.toString()}`, {
      redirect: "manual",
    });
  }

  afterAll(async () => {
    const grants = await db
      .select({ id: oauthGrant.id })
      .from(oauthGrant)
      .where(eq(oauthGrant.clientId, CIMD_ID))
      .all();
    await clearAuditLogFor({
      entityType: "oauth_grant",
      entityIds: grants.map((g) => g.id),
    });
    await db.delete(oauthGrant).where(eq(oauthGrant.clientId, CIMD_ID));
    await db
      .delete(oauthAuthorizationCode)
      .where(eq(oauthAuthorizationCode.clientId, CIMD_ID));
    await db.delete(oauthSession).where(eq(oauthSession.clientId, CIMD_ID));
    await db.delete(oauthClient).where(eq(oauthClient.clientId, CIMD_ID));
  });

  test("metadata advertises client_id_metadata_document_supported", async () => {
    const res = await app.request("/.well-known/oauth-authorization-server");
    expect((await res.json()).client_id_metadata_document_supported).toBe(true);
  });

  test("authorize with a URL client id resolves the document and completes the flow on the shared token endpoint", async () => {
    const local = cimdApp({
      client_id: CIMD_ID,
      client_name: "Partner",
      redirect_uris: [CIMD_REDIRECT],
    });
    const res = await cimdAuthorize(local);
    expect(res.status).toBe(302);
    const sessionId =
      new URL(res.headers.get("location") ?? "").searchParams.get("session") ??
      "";
    expect(sessionId).not.toBe("");

    const { redirectUrl } = await decideSession({
      input: { id: sessionId, approved: true, userId, workspaceId },
    });
    const code = new URL(redirectUrl).searchParams.get("code") ?? "";
    const token = await form("/oauth/token", {
      grant_type: "authorization_code",
      client_id: CIMD_ID,
      code,
      code_verifier: VERIFIER,
      redirect_uri: CIMD_REDIRECT,
    });
    expect(token.status).toBe(200);
    const tokens = await token.json();
    expect(
      (await mcp({ Authorization: `Bearer ${tokens.access_token}` })).status,
    ).toBe(200);
  });

  test("an unreachable or mismatched document is a 400 invalid_client", async () => {
    const missing = await cimdAuthorize(cimdApp(null));
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("invalid_client");

    const mismatched = await cimdAuthorize(
      cimdApp({
        client_id: "https://other.example/c",
        redirect_uris: [CIMD_REDIRECT],
      }),
    );
    expect(mismatched.status).toBe(400);
    expect((await mismatched.json()).error).toBe("invalid_client");
  });

  test("a URL client id on a private host is refused before any fetch", async () => {
    let fetched = false;
    const local = new Hono();
    local.route(
      "/",
      routes.createOAuthRoutes({
        ...config,
        fetchClientMetadata: async () => {
          fetched = true;
          throw new Error("should not run");
        },
      }),
    );
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "https://169.254.169.254/latest/meta-data",
      redirect_uri: CIMD_REDIRECT,
      code_challenge: await pkceChallenge(VERIFIER),
      code_challenge_method: "S256",
    });
    const res = await local.request(`/oauth/authorize?${params.toString()}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(400);
    expect(fetched).toBe(false);
  });
});
