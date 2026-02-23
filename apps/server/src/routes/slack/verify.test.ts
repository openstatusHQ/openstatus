import { describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import { Hono } from "hono";
import { verifySlackSignature } from "./verify";

const SIGNING_SECRET = "test-signing-secret";
process.env.SLACK_SIGNING_SECRET = SIGNING_SECRET;

function signRequest(body: string, timestamp: number): string {
  const basestring = `v0:${timestamp}:${body}`;
  const hmac = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(basestring)
    .digest("hex");
  return `v0=${hmac}`;
}

function createTestApp() {
  const app = new Hono<{ Variables: { slackBody: unknown } }>();
  app.post("/test", verifySlackSignature, (c) => {
    return c.json({ body: c.get("slackBody") });
  });
  return app;
}

describe("verifySlackSignature", () => {
  const app = createTestApp();

  test("accepts valid JSON signature", async () => {
    const body = JSON.stringify({ type: "event_callback", event: {} });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signRequest(body, timestamp);

    const res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": String(timestamp),
        "x-slack-signature": signature,
      },
      body,
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { body: { type: string } };
    expect(json.body.type).toBe("event_callback");
  });

  test("accepts valid form-urlencoded payload", async () => {
    const payload = JSON.stringify({
      type: "block_actions",
      user: { id: "U1" },
    });
    const body = `payload=${encodeURIComponent(payload)}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signRequest(body, timestamp);

    const res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-slack-request-timestamp": String(timestamp),
        "x-slack-signature": signature,
      },
      body,
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { body: { type: string } };
    expect(json.body.type).toBe("block_actions");
  });

  test("rejects missing headers", async () => {
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    expect(res.status).toBe(401);
  });

  test("rejects old timestamp", async () => {
    const body = "{}";
    const timestamp = Math.floor(Date.now() / 1000) - 600;
    const signature = signRequest(body, timestamp);

    const res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": String(timestamp),
        "x-slack-signature": signature,
      },
      body,
    });

    expect(res.status).toBe(401);
  });

  test("rejects invalid signature", async () => {
    const body = "{}";
    const timestamp = Math.floor(Date.now() / 1000);

    const res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": String(timestamp),
        "x-slack-signature":
          "v0=invalidsignature000000000000000000000000000000000000000000000000",
      },
      body,
    });

    expect(res.status).toBe(401);
  });

  test("rejects signature with wrong length", async () => {
    const body = "{}";
    const timestamp = Math.floor(Date.now() / 1000);

    const res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": String(timestamp),
        "x-slack-signature": "v0=short",
      },
      body,
    });

    expect(res.status).toBe(401);
  });

  test("rejects missing timestamp header only", async () => {
    const body = "{}";
    const res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-signature": "v0=abc",
      },
      body,
    });
    expect(res.status).toBe(401);
  });

  test("rejects missing signature header only", async () => {
    const body = "{}";
    const timestamp = Math.floor(Date.now() / 1000);
    const res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": String(timestamp),
      },
      body,
    });
    expect(res.status).toBe(401);
  });

  test("rejects future timestamp beyond 5 minutes", async () => {
    const body = "{}";
    const timestamp = Math.floor(Date.now() / 1000) + 600;
    const signature = signRequest(body, timestamp);

    const res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": String(timestamp),
        "x-slack-signature": signature,
      },
      body,
    });
    expect(res.status).toBe(401);
  });

  test("accepts timestamp within 5 minute window", async () => {
    const body = JSON.stringify({ type: "test" });
    const timestamp = Math.floor(Date.now() / 1000) - 200;
    const signature = signRequest(body, timestamp);

    const res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": String(timestamp),
        "x-slack-signature": signature,
      },
      body,
    });
    expect(res.status).toBe(200);
  });

  test("rejects signature computed with wrong body", async () => {
    const body = JSON.stringify({ type: "real_body" });
    const timestamp = Math.floor(Date.now() / 1000);
    const wrongSignature = signRequest("different body", timestamp);

    const res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": String(timestamp),
        "x-slack-signature": wrongSignature,
      },
      body,
    });
    expect(res.status).toBe(401);
  });

  test("handles form-urlencoded without payload param", async () => {
    const body = "key=value";
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signRequest(body, timestamp);

    const res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-slack-request-timestamp": String(timestamp),
        "x-slack-signature": signature,
      },
      body,
    });
    expect(res.status).toBe(200);
  });

  test("handles large JSON payload", async () => {
    const largePayload = { type: "test", data: "x".repeat(10000) };
    const body = JSON.stringify(largePayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signRequest(body, timestamp);

    const res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": String(timestamp),
        "x-slack-signature": signature,
      },
      body,
    });
    expect(res.status).toBe(200);
  });
});
