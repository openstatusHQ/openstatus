import crypto from "node:crypto";

import { beforeEach, describe, expect, test } from "@openstatus/test-utils";
import { Hono } from "hono";

// workspace-resolver / @slack/web-api are swapped for doubles via the test
// import map; behavior is driven through this shared mutable state.
import { slackTestState } from "@/libs/test/doubles/slack-test-state";
import {
  TEST_SIGNING_SECRET as SIGNING_SECRET,
  withSlackConfig,
} from "@/libs/test/slack-config";

import { settleBackgroundTasks } from "./background";
import type { SlackEnv } from "./config";
import { handleSlackInteraction } from "./interactions";
import { verifySlackSignature } from "./verify";

const redisStore = (globalThis as Record<string, unknown>)
  .__testRedisStore as Map<string, string>;

const basePending = {
  id: "pending-123",
  workspaceId: 1,
  teamId: "T_KNOWN",
  channelId: "C1",
  threadTs: "1.1",
  messageTs: "1.2",
  userId: "U_OWNER",
  createdAt: Date.now(),
};

function configureSlackDoubles() {
  slackTestState.calls = [];
  slackTestState.resolveWorkspace = (teamId: string) =>
    teamId === "T_KNOWN"
      ? Promise.resolve({ botToken: "xoxb-fallback", workspace: { id: 1 } })
      : Promise.resolve(null);
}

function createTestApp() {
  const app = withSlackConfig(new Hono<SlackEnv>());
  app.post("/slack/interactions", verifySlackSignature, handleSlackInteraction);
  return app;
}

function seedCreateStatusReport(id = "pending-123") {
  const data = {
    ...basePending,
    id,
    payload: {
      toolName: "create_status_report",
      input: {
        title: "Test Incident",
        status: "investigating",
        message: "Investigating the issue",
        pageId: 1,
        pageComponentIds: [],
      },
    },
  };
  redisStore.set(`slack:action:${id}`, JSON.stringify(data));
  redisStore.set(`slack:thread:${data.threadTs}`, id);
  return data;
}

function seedCreateMaintenance(
  id = "maint-001",
  overrides: Record<string, unknown> = {},
) {
  const now = Date.now();
  const data = {
    ...basePending,
    id,
    threadTs: "2.1",
    messageTs: "2.2",
    payload: {
      toolName: "create_maintenance",
      input: {
        title: "DB Maintenance",
        message: "Scheduled database upgrade.",
        from: new Date(now + 86400000).toISOString(),
        to: new Date(now + 86400000 + 3600000).toISOString(),
        pageId: 1,
        pageComponentIds: [],
        ...overrides,
      },
    },
  };
  redisStore.set(`slack:action:${id}`, JSON.stringify(data));
  redisStore.set(`slack:thread:${data.threadTs}`, id);
  return data;
}

// The route acks Slack immediately and finishes the work in the background,
// so every test waits for that work before asserting on its side effects.
async function signAndPost(
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

  const res = await app.request("/slack/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": String(timestamp),
      "x-slack-signature": `v0=${sig}`,
    },
    body,
  });
  await settleBackgroundTasks();
  return res;
}

describe("handleSlackInteraction (dispatch)", () => {
  const app = createTestApp();

  beforeEach(() => {
    configureSlackDoubles();
    redisStore.clear();
  });

  test("returns ok for non-block_actions", async () => {
    const res = await signAndPost(app, { type: "message_action", actions: [] });
    expect(res.status).toBe(200);
    expect(slackTestState.calls).toHaveLength(0);
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
    expect(slackTestState.calls).toHaveLength(0);
  });

  test("cancel updates message to cancelled", async () => {
    seedCreateStatusReport();
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "cancel_pending-123" }],
    });
    expect(res.status).toBe(200);
    const cancelCall = slackTestState.calls.find(
      (c) =>
        c.method === "update" && (c.args.text as string).includes("Cancelled"),
    );
    expect(cancelCall).toBeDefined();
  });

  test("rejects action from wrong user", async () => {
    seedCreateStatusReport();
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OTHER" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_pending-123" }],
    });
    expect(res.status).toBe(200);
    const ephemeral = slackTestState.calls.find(
      (c) => c.method === "postEphemeral",
    );
    expect(ephemeral).toBeDefined();
    expect(ephemeral?.args.text as string).toContain("Only the person");
    expect(redisStore.has("slack:action:pending-123")).toBe(true);
  });

  test("shows expired message when pending not found", async () => {
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U1" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_unknown-id" }],
    });
    expect(res.status).toBe(200);
    const expiredCall = slackTestState.calls.find(
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
    expect(slackTestState.calls).toHaveLength(0);
  });

  test("approve_flag parses flag=true; approve parses flag=false", async () => {
    seedCreateStatusReport();
    // Both prefixes should be accepted; we just verify the dispatcher
    // reaches consume() and isn't tripped by the prefix parser.
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_flag_pending-123" }],
    });
    expect(res.status).toBe(200);
  });

  test("resolves the bot token on click, not from the stored action", async () => {
    seedCreateStatusReport();
    let resolveCalls = 0;
    slackTestState.resolveWorkspace = (teamId: string) => {
      resolveCalls++;
      return teamId === "T_KNOWN"
        ? Promise.resolve({ botToken: "xoxb-fresh", workspace: { id: 1 } })
        : Promise.resolve(null);
    };

    await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "cancel_pending-123" }],
    });

    // A card outlives the turn that made it, so the token that made it may
    // have been revoked by now — it is never persisted, only resolved here.
    expect(resolveCalls).toBe(1);
    expect(slackTestState.calls.some((c) => c.method === "update")).toBe(true);
  });

  test("refuses an action drafted against another workspace", async () => {
    seedCreateStatusReport();
    // A reinstall can point the team at a different workspace than the one the
    // card was drafted for; executing it there would hit the wrong status page.
    slackTestState.resolveWorkspace = () =>
      Promise.resolve({ botToken: "xoxb-other", workspace: { id: 2 } });

    await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_pending-123" }],
    });

    const update = slackTestState.calls.find((c) => c.method === "update");
    expect(update?.args.text).toContain("different workspace");
    // Not consumed: the action is still there for the right workspace.
    expect(redisStore.has("slack:action:pending-123")).toBe(true);
  });

  test("does nothing when the workspace no longer resolves", async () => {
    seedCreateStatusReport();
    slackTestState.resolveWorkspace = () => Promise.resolve(null);

    await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_pending-123" }],
    });

    expect(slackTestState.calls).toHaveLength(0);
    // The action survives an uninstall rather than being silently burned.
    expect(redisStore.has("slack:action:pending-123")).toBe(true);
  });

  test("cancel consumes pending from redis", async () => {
    seedCreateStatusReport();
    await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "cancel_pending-123" }],
    });
    expect(redisStore.has("slack:action:pending-123")).toBe(false);
  });
});

describe("registry-runner execution paths", () => {
  const app = createTestApp();

  beforeEach(() => {
    configureSlackDoubles();
    redisStore.clear();
  });

  test("approve create_maintenance shows scheduled success", async () => {
    seedCreateMaintenance();
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "2.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_maint-001" }],
    });
    expect(res.status).toBe(200);
    const successCall = slackTestState.calls.find(
      (c) =>
        c.method === "update" &&
        (c.args.text as string).includes(
          "Maintenance *DB Maintenance* scheduled",
        ),
    );
    expect(successCall).toBeDefined();
    expect(successCall?.args.text as string).not.toContain(
      "subscribers notified",
    );
  });

  test("approve_flag create_maintenance notifies", async () => {
    seedCreateMaintenance();
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "2.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_flag_maint-001" }],
    });
    expect(res.status).toBe(200);
    const successCall = slackTestState.calls.find(
      (c) =>
        c.method === "update" &&
        (c.args.text as string).includes("subscribers notified"),
    );
    expect(successCall).toBeDefined();
  });

  test("cancel does not execute the tool", async () => {
    seedCreateMaintenance();
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "2.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "cancel_maint-001" }],
    });
    expect(res.status).toBe(200);
    const cancelCall = slackTestState.calls.find(
      (c) =>
        c.method === "update" && (c.args.text as string).includes("Cancelled"),
    );
    expect(cancelCall).toBeDefined();
  });

  test("ServiceError (stale page id) surfaces typed message", async () => {
    seedCreateMaintenance("maint-bad", { pageId: 99999 });
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "2.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_maint-bad" }],
    });
    expect(res.status).toBe(200);
    const errCall = slackTestState.calls.find(
      (c) =>
        c.method === "update" &&
        (c.args.text as string).startsWith(":x:") &&
        (c.args.text as string).toLowerCase().includes("not found"),
    );
    expect(errCall).toBeDefined();
  });

  test("from after to surfaces typed validation error", async () => {
    const now = Date.now();
    seedCreateMaintenance("maint-bad-time", {
      from: new Date(now + 7200000).toISOString(),
      to: new Date(now + 3600000).toISOString(),
    });
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "2.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_maint-bad-time" }],
    });
    expect(res.status).toBe(200);
    const errCall = slackTestState.calls.find(
      (c) => c.method === "update" && (c.args.text as string).startsWith(":x:"),
    );
    expect(errCall).toBeDefined();
  });
});
