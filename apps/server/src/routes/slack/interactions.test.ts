import { beforeEach, describe, expect, mock, test } from "bun:test";
import crypto from "node:crypto";
import { Hono } from "hono";

const SIGNING_SECRET = "test-signing-secret";

process.env.SLACK_SIGNING_SECRET = SIGNING_SECRET;
process.env.AI_GATEWAY_API_KEY = "test-key";

const redisStore = (globalThis as Record<string, unknown>)
  .__testRedisStore as Map<string, string>;

const pendingData = {
  id: "pending-123",
  workspaceId: 1,
  limits: {},
  botToken: "xoxb-test",
  channelId: "C1",
  threadTs: "1.1",
  messageTs: "1.2",
  userId: "U_OWNER",
  createdAt: Date.now(),
  action: {
    type: "createStatusReport" as const,
    params: {
      title: "Test Incident",
      status: "investigating" as const,
      message: "Investigating the issue",
      pageId: 1,
    },
  },
};

mock.module("./workspace-resolver", () => ({
  resolveWorkspace: (teamId: string) => {
    if (teamId === "T_KNOWN") {
      return Promise.resolve({ botToken: "xoxb-fallback" });
    }
    return Promise.resolve(null);
  },
}));

let slackCalls: Array<{ method: string; args: Record<string, unknown> }> = [];

mock.module("@slack/web-api", () => ({
  WebClient: class {
    chat = {
      update: (args: Record<string, unknown>) => {
        slackCalls.push({ method: "update", args });
        return Promise.resolve();
      },
      postEphemeral: (args: Record<string, unknown>) => {
        slackCalls.push({ method: "postEphemeral", args });
        return Promise.resolve();
      },
    };
  },
}));

const { handleSlackInteraction } = await import("./interactions");
const { verifySlackSignature } = await import("./verify");

function createTestApp() {
  const app = new Hono<{ Variables: { slackBody: unknown } }>();
  app.post("/slack/interactions", verifySlackSignature, handleSlackInteraction);
  return app;
}

function seedPendingAction() {
  redisStore.set(`slack:action:${pendingData.id}`, JSON.stringify(pendingData));
  redisStore.set(`slack:thread:${pendingData.threadTs}`, pendingData.id);
}

function signAndPost(
  app: ReturnType<typeof createTestApp>,
  payload: Record<string, unknown>,
) {
  const payloadStr = JSON.stringify(payload);
  const body = `payload=${encodeURIComponent(payloadStr)}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const basestring = `v0:${timestamp}:${body}`;
  const sig = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(basestring)
    .digest("hex");

  return app.request("/slack/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": String(timestamp),
      "x-slack-signature": `v0=${sig}`,
    },
    body,
  });
}

describe("handleSlackInteraction", () => {
  const app = createTestApp();

  beforeEach(() => {
    slackCalls = [];
    redisStore.clear();
  });

  test("returns ok for non-block_actions", async () => {
    const res = await signAndPost(app, {
      type: "message_action",
      actions: [],
    });

    expect(res.status).toBe(200);
    expect(slackCalls).toHaveLength(0);
  });

  test("returns ok for unknown action_id prefix", async () => {
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U1" },
      channel: { id: "C1" },
      message: { ts: "1.1" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "unknown_action" }],
    });

    expect(res.status).toBe(200);
    expect(slackCalls).toHaveLength(0);
  });

  test("cancel updates message to cancelled", async () => {
    seedPendingAction();

    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "cancel_pending-123" }],
    });

    expect(res.status).toBe(200);
    const cancelCall = slackCalls.find(
      (c) =>
        c.method === "update" && (c.args.text as string).includes("Cancelled"),
    );
    expect(cancelCall).toBeDefined();
  });

  test("rejects action from wrong user", async () => {
    seedPendingAction();

    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OTHER" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_pending-123" }],
    });

    expect(res.status).toBe(200);
    const ephemeral = slackCalls.find((c) => c.method === "postEphemeral");
    expect(ephemeral).toBeDefined();
    expect(ephemeral?.args.text as string).toContain("Only the person");

    // Pending action should NOT be consumed — still available for the real owner
    expect(redisStore.has(`slack:action:${pendingData.id}`)).toBe(true);
  });

  test("shows expired message when pending action not found", async () => {
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U1" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_unknown-id" }],
    });

    expect(res.status).toBe(200);
    const expiredCall = slackCalls.find(
      (c) =>
        c.method === "update" && (c.args.text as string).includes("expired"),
    );
    expect(expiredCall).toBeDefined();
  });

  test("returns ok when no bot token available", async () => {
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U1" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_UNKNOWN" },
      actions: [{ action_id: "approve_some-id" }],
    });

    expect(res.status).toBe(200);
    expect(slackCalls).toHaveLength(0);
  });

  test("falls back to workspace resolver when pending has no botToken", async () => {
    const noTokenPending = {
      ...pendingData,
      id: "pending-notoken",
      botToken: "",
      createdAt: Date.now(),
    };
    redisStore.set(
      `slack:action:${noTokenPending.id}`,
      JSON.stringify(noTokenPending),
    );

    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "cancel_pending-notoken" }],
    });

    expect(res.status).toBe(200);
    // Should still work via workspace resolver fallback
    const cancelCall = slackCalls.find(
      (c) =>
        c.method === "update" && (c.args.text as string).includes("Cancelled"),
    );
    expect(cancelCall).toBeDefined();
  });

  test("returns ok with empty actions array", async () => {
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U1" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [],
    });

    expect(res.status).toBe(200);
    expect(slackCalls).toHaveLength(0);
  });

  test("parses approve_notify prefix correctly", async () => {
    seedPendingAction();

    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_notify_pending-123" }],
    });

    // approve_notify should extract pending ID as "pending-123"
    // Since the action exists and user matches, it tries to execute
    expect(res.status).toBe(200);
  });

  test("returns ok when no team id and no pending", async () => {
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U1" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      actions: [{ action_id: "approve_orphan-id" }],
    });

    expect(res.status).toBe(200);
    expect(slackCalls).toHaveLength(0);
  });

  test("cancel consumes pending action from redis", async () => {
    seedPendingAction();

    await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "cancel_pending-123" }],
    });

    // After cancel, the pending action should be consumed from redis
    expect(redisStore.has(`slack:action:${pendingData.id}`)).toBe(false);
  });
});
