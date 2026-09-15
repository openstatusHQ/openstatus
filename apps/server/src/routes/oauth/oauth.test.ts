import { sentry } from "@hono/sentry";
import { db, eq, inArray } from "@openstatus/db";
import {
  oauthAuthorizationCode,
  oauthClient,
  oauthGrant,
  oauthSession,
} from "@openstatus/db/src/schema";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import {
  ClientMetadataUnavailableError,
  OAuthError,
  decideSession,
  parseClientMetadataDocument,
  pkceChallenge,
} from "@openstatus/services/oauth";
import { clearAuditLogFor } from "@openstatus/services/test/helpers";
import { expect } from "@std/expect";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  test,
} from "@std/testing/bdd";
import { type Context, Hono, type Next } from "hono";

import { app } from "../../index";
import { oauthConfigFromEnv } from "./config";
import * as routes from "./index";
import { resetRedirectUriCaptureWindow } from "./telemetry";

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

type CapturedEvent = {
  message: string;
  level?: string;
  fingerprint?: string[];
  context?: Record<string, unknown>;
};

/** Toucan needs a DSN and a live fetch; this covers what the route touches. */
function stubSentry() {
  const events: CapturedEvent[] = [];
  const state: { enabled: boolean; level?: string } = { enabled: true };
  const sentry = {
    setEnabled(enabled: boolean) {
      state.enabled = enabled;
    },
    setLevel(level: string) {
      state.level = level;
    },
    withScope(run: (scope: unknown) => void) {
      const event: CapturedEvent = { message: "" };
      const scope = {
        setFingerprint(fingerprint: string[]) {
          event.fingerprint = fingerprint;
          return scope;
        },
        setContext(_name: string, context: Record<string, unknown>) {
          event.context = context;
          return scope;
        },
        captureMessage(message: string, level?: string) {
          events.push({ ...event, message, level });
          return "event-id";
        },
      };
      run(scope);
    },
  };
  return { sentry, events, state };
}

function withStubSentry(stub: ReturnType<typeof stubSentry>["sentry"]) {
  return async (c: Context, next: Next) => {
    // Only the members above are ever called on it.
    c.set("sentry", stub as never);
    await next();
  };
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

describe("rejected registrations report as warnings", () => {
  const FINGERPRINT = ["oauth", "register", "redirect_uri_rejected"];

  function build() {
    const stub = stubSentry();
    const local = new Hono();
    const wideEvents: Record<string, unknown>[] = [];
    local.use("*", withStubSentry(stub.sentry));
    local.use("*", async (c, next) => {
      const event: Record<string, unknown> = {};
      wideEvents.push(event);
      c.set("event" as never, event as never);
      await next();
    });
    local.route("/", routes.createOAuthRoutes(config));
    return { ...stub, local, wideEvents };
  }

  function register(local: Hono, redirectUris: string[]) {
    return local.request("/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirect_uris: redirectUris }),
    });
  }

  beforeEach(() => resetRedirectUriCaptureWindow());

  test("400 as before, captured as a warning fingerprinted by origin", async () => {
    const { local, events, state } = build();
    const uri = "https://glama.ai/api/app/mcp/oauth/callback";
    const res = await register(local, [uri]);

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_redirect_uri" });
    expect(events).toEqual([
      {
        message: "redirect_uri host not allowlisted",
        level: "warning",
        fingerprint: [...FINGERPRINT, "https://glama.ai"],
        context: { origin: "https://glama.ai", rejected: [uri] },
      },
    ]);
    // the raw exception must not also land in the error stream
    expect(state.enabled).toBe(false);
  });

  test("two paths on one host share an issue; a second host opens its own", async () => {
    const { local, events } = build();
    await register(local, ["https://glama.ai/one"]);
    resetRedirectUriCaptureWindow();
    await register(local, ["https://glama.ai/two"]);
    await register(local, ["https://attacker.example/cb"]);

    expect(events.map((e) => e.fingerprint)).toEqual([
      [...FINGERPRINT, "https://glama.ai"],
      [...FINGERPRINT, "https://glama.ai"],
      [...FINGERPRINT, "https://attacker.example"],
    ]);
    expect(new Set(events.map((e) => e.message)).size).toBe(1);
  });

  test("a repeat within the window is captured once but counted twice", async () => {
    const { local, events, wideEvents } = build();
    expect((await register(local, ["https://glama.ai/cb"])).status).toBe(400);
    expect((await register(local, ["https://glama.ai/cb"])).status).toBe(400);

    expect(events).toHaveLength(1);
    // the counter is the demand signal, so the deduped repeat still records
    expect(wideEvents.map((e) => e.oauth_register_rejected_origins)).toEqual([
      ["https://glama.ai"],
      ["https://glama.ai"],
    ]);
  });

  test("a flood of origins stays bounded and buys nothing on replay", async () => {
    const { local, events } = build();
    // ten per request is the schema maximum, so this is the cheapest flood
    const flood = Array.from({ length: 120 }, (_, batch) =>
      Array.from(
        { length: 10 },
        (_, i) => `https://flood-${batch * 10 + i}.example/cb`,
      ),
    );
    for (const batch of flood) await register(local, batch);
    // 1200 distinct origins, capped by the slot table
    const firstPass = events.length;
    expect(firstPass).toBeLessThanOrEqual(1024);

    for (const batch of flood) await register(local, batch);
    expect(events.length).toBe(firstPass);
  });

  test("a malformed redirect_uri buckets instead of throwing", async () => {
    const { local, events } = build();
    const res = await register(local, ["not-a-url"]);
    expect(res.status).toBe(400);
    expect(events[0]?.fingerprint).toEqual([...FINGERPRINT, "<unparseable>"]);
  });

  test("other client faults stay in Sentry, downgraded to warning", async () => {
    const { local, events, state } = build();
    const res = await local.request("/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "whatever",
      }).toString(),
    });
    expect(res.status).toBe(400);
    expect(state.level).toBe("warning");
    expect(state.enabled).toBe(true);
    expect(events).toEqual([]);
  });
});

/**
 * The stub above records the calls the route makes; this drives the real SDK
 * and reads the envelope at the transport, which is where `setEnabled(false)`
 * takes effect — so what would reach Sentry is asserted, not assumed.
 */
describe("severity through the real Sentry client", () => {
  type Probe = {
    level?: string;
    message?: string;
    fingerprint?: string[];
    exception?: unknown;
  };

  /** Envelope wire format: header, then alternating item header and payload. */
  function eventsIn(body: unknown): Probe[] {
    const lines = String(body).split("\n").filter(Boolean);
    const events: Probe[] = [];
    for (let i = 1; i < lines.length; i += 2) {
      if (JSON.parse(lines[i]).type === "event") {
        events.push(JSON.parse(lines[i + 1]));
      }
    }
    return events;
  }

  function build(config_ = config) {
    const sent: Probe[] = [];
    const local = new Hono();
    local.use(
      "*",
      sentry({
        dsn: "https://0123456789abcdef0123456789abcdef@o1.ingest.sentry.io/1",
        transportOptions: {
          fetcher: (_url: unknown, init?: { body?: unknown }) => {
            sent.push(...eventsIn(init?.body));
            return Promise.resolve(new Response("{}"));
          },
        },
      } as Parameters<typeof sentry>[0]),
    );
    local.route("/", routes.createOAuthRoutes(config_));
    return { local, sent };
  }

  /** Capture runs after the response resolves, then the event pipeline is async. */
  const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

  beforeEach(() => resetRedirectUriCaptureWindow());

  test("a rejected redirect_uri arrives as one warning, grouped by origin", async () => {
    const { local, sent } = build();
    const res = await local.request("/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["https://glama.ai/cb"] }),
    });
    expect(res.status).toBe(400);
    await flush();

    // exactly one: the raw exception is suppressed before the transport
    expect(sent).toHaveLength(1);
    expect(sent[0]?.level).toBe("warning");
    expect(sent[0]?.message).toBe("redirect_uri host not allowlisted");
    expect(sent[0]?.fingerprint).toEqual([
      "oauth",
      "register",
      "redirect_uri_rejected",
      "https://glama.ai",
    ]);
  });

  test("another client fault is downgraded to warning, not dropped", async () => {
    const { local, sent } = build();
    const res = await local.request("/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "whatever",
      }).toString(),
    });
    expect(res.status).toBe(400);
    await flush();

    expect(sent).toHaveLength(1);
    expect(sent[0]?.level).toBe("warning");
  });

  test("a server fault still arrives as an error", async () => {
    const { local, sent } = build({
      ...config,
      fetchClientMetadata: () => {
        throw new Error("boom");
      },
    });
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "https://partner.example/.well-known/oauth-client",
      redirect_uri: "https://partner.example/oauth/callback",
      code_challenge: await pkceChallenge(VERIFIER),
      code_challenge_method: "S256",
    });
    const res = await local.request(`/oauth/authorize?${params}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(500);
    await flush();

    // an exception event carries no explicit level, which Sentry reads as error
    expect(sent).toHaveLength(1);
    expect(sent[0]?.exception).toBeDefined();
    expect(sent[0]?.level).not.toBe("warning");
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
  test("/mcp without any credential is the 401 that starts discovery", async () => {
    // `/mcp` is a protected resource with no anonymous surface: a client that
    // `initialize`s before it holds a token is told where the authorization
    // server is rather than being handed a credential-less session.
    const res = await mcp();
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="${config.issuer}/.well-known/oauth-protected-resource/mcp"`,
    );
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

  /** `null` answers 404 (gone); `"unavailable"` a bot challenge (403). */
  function cimdApp(document: Record<string, unknown> | null | "unavailable") {
    const { createOAuthRoutes } = routes;
    const local = new Hono();
    local.route(
      "/",
      createOAuthRoutes({
        ...config,
        fetchClientMetadata: async (clientId) => {
          if (document === "unavailable") {
            throw new ClientMetadataUnavailableError(
              "Client metadata document responded with HTTP 403",
            );
          }
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

  test("an unreachable or mismatched document for an unknown client is a 400 invalid_client", async () => {
    // A client id never stored, so no fallback document exists.
    const unknown = { client_id: "https://partner.example/.well-known/other" };
    const missing = await cimdAuthorize(cimdApp(null), unknown);
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("invalid_client");

    const mismatched = await cimdAuthorize(
      cimdApp({
        client_id: "https://other.example/c",
        redirect_uris: [CIMD_REDIRECT],
      }),
      unknown,
    );
    expect(mismatched.status).toBe(400);
    expect((await mismatched.json()).error).toBe("invalid_client");
  });

  test("an unreachable document for a stored client falls back to the stored row", async () => {
    // Seed the row here so the test does not depend on sibling order.
    const seeded = await cimdAuthorize(
      cimdApp({ client_id: CIMD_ID, redirect_uris: [CIMD_REDIRECT] }),
    );
    expect(seeded.status).toBe(302);

    const res = await cimdAuthorize(cimdApp("unavailable"));
    expect(res.status).toBe(302);
    expect(
      new URL(res.headers.get("location") ?? "").searchParams.get("session"),
    ).not.toBeNull();

    const gone = await cimdAuthorize(cimdApp(null));
    expect(gone.status).toBe(400);
  });

  test("a plain failure inside the fetcher is still an error, not a warning", async () => {
    const stub = stubSentry();
    const local = new Hono();
    local.use("*", withStubSentry(stub.sentry));
    local.route(
      "/",
      routes.createOAuthRoutes({
        ...config,
        fetchClientMetadata: () => {
          throw new Error("boom");
        },
      }),
    );
    const params = new URLSearchParams({
      response_type: "code",
      client_id: CIMD_ID,
      redirect_uri: CIMD_REDIRECT,
      code_challenge: await pkceChallenge(VERIFIER),
      code_challenge_method: "S256",
    });
    const res = await local.request(`/oauth/authorize?${params}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(500);
    expect(stub.state.level).toBeUndefined();
    expect(stub.state.enabled).toBe(true);
    expect(stub.events).toEqual([]);
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
