import { beforeEach, describe, expect, mock, test } from "bun:test";
import crypto from "node:crypto";
import { Hono } from "hono";

const SIGNING_SECRET = "test-signing-secret";

process.env.SLACK_SIGNING_SECRET = SIGNING_SECRET;
process.env.AI_GATEWAY_API_KEY = "test-key";

mock.module("./workspace-resolver", () => ({
  resolveWorkspace: (teamId: string) => {
    if (teamId === "T_KNOWN") {
      return Promise.resolve({
        workspace: {
          id: 1,
          name: "Test Workspace",
          slug: "test",
          plan: "free",
          limits: {},
        },
        botToken: "xoxb-test",
        botUserId: "UBOT",
      });
    }
    return Promise.resolve(null);
  },
}));

let slackMessages: Array<{ method: string; args: unknown }> = [];

mock.module("@slack/web-api", () => ({
  WebClient: class {
    chat = {
      postMessage: (args: unknown) => {
        slackMessages.push({ method: "postMessage", args });
        return Promise.resolve({ ts: "msg.ts" });
      },
      update: (args: unknown) => {
        slackMessages.push({ method: "update", args });
        return Promise.resolve({ ts: "msg.ts" });
      },
    };
    conversations = {
      replies: () =>
        Promise.resolve({
          messages: [{ user: "U1", text: "test message", ts: "1.1" }],
        }),
    };
  },
}));

mock.module("./agent", () => ({
  runAgent: () =>
    Promise.resolve({
      text: "Here is my response",
      toolResults: [],
    }),
}));

const { handleSlackEvent } = await import("./handler");
const { verifySlackSignature } = await import("./verify");

function createTestApp() {
  const app = new Hono<{ Variables: { slackBody: unknown } }>();
  app.post("/slack/events", verifySlackSignature, handleSlackEvent);
  return app;
}

function signAndPost(
  app: ReturnType<typeof createTestApp>,
  body: Record<string, unknown>,
) {
  const rawBody = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000);
  const basestring = `v0:${timestamp}:${rawBody}`;
  const sig = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(basestring)
    .digest("hex");

  return app.request("/slack/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-slack-request-timestamp": String(timestamp),
      "x-slack-signature": `v0=${sig}`,
    },
    body: rawBody,
  });
}

describe("handleSlackEvent", () => {
  const app = createTestApp();

  beforeEach(() => {
    slackMessages = [];
  });

  test("responds to url_verification challenge", async () => {
    const res = await signAndPost(app, {
      type: "url_verification",
      challenge: "test-challenge-123",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { challenge: string };
    expect(json.challenge).toBe("test-challenge-123");
  });

  test("returns ok for non-event_callback types", async () => {
    const res = await signAndPost(app, {
      type: "app_rate_limited",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  test("returns ok for event_callback", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_${Date.now()}_1`,
      event: {
        type: "app_mention",
        text: "<@UBOT> create an incident",
        user: "U1",
        channel: "C1",
        ts: "100.1",
      },
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  test("handles app_uninstalled event", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_uninstall_${Date.now()}`,
      event: {
        type: "app_uninstalled",
      },
    });

    expect(res.status).toBe(200);
  });

  test("handles tokens_revoked event", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_revoked_${Date.now()}`,
      event: {
        type: "tokens_revoked",
      },
    });

    expect(res.status).toBe(200);
  });

  test("deduplicates events with same event_id", async () => {
    const eventId = `evt_dedup_${Date.now()}`;
    const body = {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: eventId,
      event: {
        type: "app_mention",
        text: "<@UBOT> hello",
        user: "U1",
        channel: "C1",
        ts: `${Date.now()}.1`,
      },
    };

    await signAndPost(app, body);
    await new Promise((r) => setTimeout(r, 50));

    slackMessages = [];
    await signAndPost(app, body);
    await new Promise((r) => setTimeout(r, 50));

    expect(slackMessages.length).toBe(0);
  });

  test("ignores events from unknown teams", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_UNKNOWN",
      event_id: `evt_unknown_${Date.now()}`,
      event: {
        type: "app_mention",
        text: "<@UBOT> hello",
        user: "U1",
        channel: "C1",
        ts: `${Date.now()}.2`,
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(slackMessages.length).toBe(0);
  });

  test("ignores message events from bots", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_bot_${Date.now()}`,
      event: {
        type: "message",
        text: "bot message",
        bot_id: "B123",
        channel: "C1",
        ts: `${Date.now()}.3`,
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(slackMessages.length).toBe(0);
  });

  test("ignores channel message without bot mention", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_nomention_${Date.now()}`,
      event: {
        type: "message",
        text: "just a regular message",
        user: "U1",
        channel: "C1",
        channel_type: "channel",
        ts: `${Date.now()}.4`,
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(slackMessages.length).toBe(0);
  });

  test("processes DM messages without bot mention", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_dm_${Date.now()}`,
      event: {
        type: "message",
        text: "hello in DM",
        user: "U1",
        channel: "D1",
        channel_type: "im",
        ts: `${Date.now()}.5`,
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    // DM should trigger a response (postMessage for "Thinking...")
    expect(slackMessages.length).toBeGreaterThan(0);
  });

  test("ignores events without channel", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_nochan_${Date.now()}`,
      event: {
        type: "app_mention",
        text: "<@UBOT> hello",
        user: "U1",
        ts: `${Date.now()}.6`,
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(slackMessages.length).toBe(0);
  });

  test("ignores events without timestamp", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_nots_${Date.now()}`,
      event: {
        type: "app_mention",
        text: "<@UBOT> hello",
        user: "U1",
        channel: "C1",
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(slackMessages.length).toBe(0);
  });

  test("ignores events without team_id", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      event_id: `evt_noteam_${Date.now()}`,
      event: {
        type: "app_mention",
        text: "<@UBOT> hello",
        user: "U1",
        channel: "C1",
        ts: `${Date.now()}.7`,
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(slackMessages.length).toBe(0);
  });

  test("ignores unsupported event types", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_unsupported_${Date.now()}`,
      event: {
        type: "channel_created",
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(slackMessages.length).toBe(0);
  });

  test("ignores events with no event payload", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_noevent_${Date.now()}`,
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(slackMessages.length).toBe(0);
  });
});
