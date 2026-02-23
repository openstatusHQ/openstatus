import { describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import { Hono } from "hono";
import { handleSlackInstall, handleSlackOAuthCallback } from "./oauth";

const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET ?? "test-signing-secret";

process.env.SLACK_SIGNING_SECRET = SIGNING_SECRET;
process.env.SLACK_CLIENT_ID = "test-client-id";
process.env.SLACK_CLIENT_SECRET = "test-client-secret";
process.env.NODE_ENV = "development";

function createTestApp() {
  const app = new Hono();
  app.get("/slack/install", handleSlackInstall);
  app.get("/slack/oauth/callback", handleSlackOAuthCallback);
  return app;
}

function encodeState(state: { workspaceId: number; ts: number }): string {
  const payload = JSON.stringify(state);
  const signature = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

describe("handleSlackInstall", () => {
  const app = createTestApp();

  test("redirects to Slack OAuth URL with correct params", async () => {
    const res = await app.request("/slack/install?workspaceId=1");

    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("https://slack.com/oauth/v2/authorize");
    expect(location).toContain("client_id=test-client-id");
    expect(location).toContain("scope=");
    expect(location).toContain("state=");
    expect(location).toContain("redirect_uri=");
  });

  test("returns 400 when workspaceId is missing", async () => {
    const res = await app.request("/slack/install");

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("workspaceId is required");
  });

  test("includes all required bot scopes", async () => {
    const res = await app.request("/slack/install?workspaceId=1");
    const location = res.headers.get("location")!;
    const url = new URL(location);
    const scope = url.searchParams.get("scope")!;

    const expectedScopes = [
      "app_mentions:read",
      "channels:history",
      "chat:write",
      "groups:history",
      "im:history",
      "im:read",
      "im:write",
      "mpim:history",
    ];

    for (const s of expectedScopes) {
      expect(scope).toContain(s);
    }
  });

  test("state contains signed workspaceId", async () => {
    const res = await app.request("/slack/install?workspaceId=42");
    const location = res.headers.get("location")!;
    const url = new URL(location);
    const state = url.searchParams.get("state")!;

    const decoded = Buffer.from(state, "base64url").toString();
    const dotIdx = decoded.lastIndexOf(".");
    const payload = JSON.parse(decoded.slice(0, dotIdx));

    expect(payload.workspaceId).toBe(42);
    expect(payload.ts).toBeGreaterThan(0);
  });
});

describe("handleSlackOAuthCallback", () => {
  const app = createTestApp();

  test("redirects to error page on Slack error", async () => {
    const res = await app.request("/slack/oauth/callback?error=access_denied");

    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("slack=error");
  });

  test("returns 400 when code is missing", async () => {
    const state = encodeState({ workspaceId: 1, ts: Date.now() });
    const res = await app.request(`/slack/oauth/callback?state=${state}`);

    expect(res.status).toBe(400);
  });

  test("returns 400 when state is missing", async () => {
    const res = await app.request("/slack/oauth/callback?code=test-code");

    expect(res.status).toBe(400);
  });

  test("returns 400 for expired state", async () => {
    const expiredState = encodeState({
      workspaceId: 1,
      ts: Date.now() - 15 * 60 * 1000,
    });
    const res = await app.request(
      `/slack/oauth/callback?code=test-code&state=${expiredState}`,
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Invalid or expired state");
  });

  test("returns 400 for tampered state", async () => {
    const payload = JSON.stringify({ workspaceId: 1, ts: Date.now() });
    const tamperedState = Buffer.from(`${payload}.invalidsignature`).toString(
      "base64url",
    );
    const res = await app.request(
      `/slack/oauth/callback?code=test-code&state=${tamperedState}`,
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Invalid or expired state");
  });
});
