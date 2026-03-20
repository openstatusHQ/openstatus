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

let slackMessages: Array<{ method: string; args: Record<string, unknown> }> =
  [];
let postMessageOverride:
  | ((args: Record<string, unknown>) => Promise<{ ts: string }>)
  | null = null;
let updateOverride:
  | ((args: Record<string, unknown>) => Promise<{ ts: string }>)
  | null = null;

mock.module("@slack/web-api", () => ({
  WebClient: class {
    chat = {
      postMessage: (args: Record<string, unknown>) => {
        if (postMessageOverride) return postMessageOverride(args);
        slackMessages.push({ method: "postMessage", args });
        return Promise.resolve({ ts: "msg.ts" });
      },
      update: (args: Record<string, unknown>) => {
        if (updateOverride) return updateOverride(args);
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

let runAgentOverride:
  | (() => Promise<{ text: string; toolResults: never[] }>)
  | null = null;

mock.module("./agent", () => ({
  runAgent: () => {
    if (runAgentOverride) return runAgentOverride();
    return Promise.resolve({
      text: "Here is my response",
      toolResults: [],
    });
  },
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
    postMessageOverride = null;
    updateOverride = null;
    runAgentOverride = null;
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

  test("ignores channel_join system messages", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_join_${Date.now()}`,
      event: {
        type: "message",
        subtype: "channel_join",
        text: "<@U1> has joined the channel",
        user: "U1",
        channel: "C1",
        ts: `${Date.now()}.10`,
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(slackMessages.length).toBe(0);
  });

  test("ignores channel_leave system messages", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_leave_${Date.now()}`,
      event: {
        type: "message",
        subtype: "channel_leave",
        text: "<@U1> has left the channel",
        user: "U1",
        channel: "C1",
        ts: `${Date.now()}.11`,
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

  test("falls back to top-level message on cannot_reply_to_message", async () => {
    let callCount = 0;
    postMessageOverride = (args: Record<string, unknown>) => {
      callCount++;
      if (callCount === 1) {
        const err = new Error("An API error occurred: cannot_reply_to_message");
        Object.assign(err, {
          code: "slack_webapi_platform_error",
          data: { ok: false, error: "cannot_reply_to_message" },
        });
        return Promise.reject(err);
      }
      slackMessages.push({ method: "postMessage", args });
      return Promise.resolve({ ts: "fallback.ts" });
    };

    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_cantreply_${Date.now()}`,
      event: {
        type: "app_mention",
        text: "<@UBOT> hello",
        user: "U1",
        channel: "C1",
        ts: `${Date.now()}.20`,
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));

    const fallbackPost = slackMessages.find(
      (m) => m.method === "postMessage" && !m.args.thread_ts,
    );
    expect(fallbackPost).toBeDefined();
  });

  test("returns early on non-recoverable postMessage error", async () => {
    postMessageOverride = () => {
      const err = new Error("An API error occurred: channel_not_found");
      Object.assign(err, {
        code: "slack_webapi_platform_error",
        data: { ok: false, error: "channel_not_found" },
      });
      return Promise.reject(err);
    };

    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_channotfound_${Date.now()}`,
      event: {
        type: "app_mention",
        text: "<@UBOT> hello",
        user: "U1",
        channel: "C1",
        ts: `${Date.now()}.21`,
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));

    const updateMessages = slackMessages.filter((m) => m.method === "update");
    expect(updateMessages.length).toBe(0);
  });

  test("shows error message when runAgent throws", async () => {
    runAgentOverride = () => Promise.reject(new Error("agent exploded"));

    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_agenterr_${Date.now()}`,
      event: {
        type: "app_mention",
        text: "<@UBOT> hello",
        user: "U1",
        channel: "C1",
        ts: `${Date.now()}.30`,
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));

    const errorUpdate = slackMessages.find(
      (m) =>
        m.method === "update" &&
        typeof m.args.text === "string" &&
        m.args.text.includes("Something went wrong"),
    );
    expect(errorUpdate).toBeDefined();
  });

  test("does not throw when both runAgent and error update fail", async () => {
    runAgentOverride = () => Promise.reject(new Error("agent exploded"));
    updateOverride = () => {
      const err = new Error("An API error occurred: channel_not_found");
      Object.assign(err, {
        code: "slack_webapi_platform_error",
        data: { ok: false, error: "channel_not_found" },
      });
      return Promise.reject(err);
    };

    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_doublefail_${Date.now()}`,
      event: {
        type: "app_mention",
        text: "<@UBOT> hello",
        user: "U1",
        channel: "C1",
        ts: `${Date.now()}.31`,
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));
    // No unhandled rejection — the .catch() in the error handler swallows it
  });
});
