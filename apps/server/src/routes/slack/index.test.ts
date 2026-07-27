import crypto from "node:crypto";

import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import { Hono } from "hono";

import type { SlackConfig } from "./config";
import { createSlackRoute } from "./index";

const SIGNING_SECRET = "test-signing-secret";

function signRequest(body: string, timestamp: number): string {
  const basestring = `v0:${timestamp}:${body}`;
  const hmac = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(basestring)
    .digest("hex");
  return `v0=${hmac}`;
}

function makeInstallToken(workspaceId: number): string {
  const payload = JSON.stringify({ workspaceId, ts: Date.now() });
  const sig = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

const BASE_CONFIG: SlackConfig = {
  signingSecret: SIGNING_SECRET,
  clientId: "test-client-id",
  aiGatewayApiKey: "test-key",
  dashboardUrl: "http://localhost:3000",
};

function makeApp(overrides: Partial<SlackConfig> = {}) {
  const app = new Hono();
  app.route("/slack", createSlackRoute({ ...BASE_CONFIG, ...overrides }));
  return app;
}

describe("slack route middleware", () => {
  test("returns 503 when SLACK_SIGNING_SECRET is missing", async () => {
    const app = makeApp({ signingSecret: "" });

    const res = await app.request("/slack/install?token=invalid");

    expect(res.status).toBe(503);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Slack agent not configured");
  });

  test("returns 503 when AI_GATEWAY_API_KEY is missing", async () => {
    const app = makeApp({ aiGatewayApiKey: "" });

    const res = await app.request("/slack/install?token=invalid");

    expect(res.status).toBe(503);
  });

  test("GET /install is accessible with valid token", async () => {
    const app = makeApp();

    const token = makeInstallToken(1);
    const res = await app.request(`/slack/install?token=${token}`);
    // Should redirect (302) to Slack OAuth, not 404
    expect(res.status).toBe(302);
  });

  test("GET /install rejects invalid token", async () => {
    const app = makeApp();

    const res = await app.request("/slack/install?token=invalid");
    expect(res.status).toBe(403);
  });

  test("POST /events requires signature verification", async () => {
    const app = makeApp();

    // POST without signature headers should fail
    const res = await app.request("/slack/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "url_verification", challenge: "test" }),
    });

    expect(res.status).toBe(401);
  });

  test("POST /events accepts valid signed request", async () => {
    const app = makeApp();

    const body = JSON.stringify({
      type: "url_verification",
      challenge: "test-challenge",
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signRequest(body, timestamp);

    const res = await app.request("/slack/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": String(timestamp),
        "x-slack-signature": signature,
      },
      body,
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { challenge: string };
    expect(json.challenge).toBe("test-challenge");
  });

  test("POST /interactions requires signature verification", async () => {
    const app = makeApp();

    const res = await app.request("/slack/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "payload={}",
    });

    expect(res.status).toBe(401);
  });
});
