import crypto from "node:crypto";

import { beforeEach, describe, expect, test } from "@openstatus/test-utils";
import { Hono } from "hono";

// workspace-resolver / @slack/web-api / agent are swapped for doubles via the
// test import map; behavior is driven through this shared mutable state.
import { slackTestState } from "@/libs/test/doubles/slack-test-state";
import {
  TEST_SIGNING_SECRET as SIGNING_SECRET,
  withSlackConfig,
} from "@/libs/test/slack-config";

import type { SlackEnv } from "./config";
import {
  handleSlackEvent,
  isAnswerToAgent,
  looksLikeUncardedDraft,
  toolTaskTitle,
} from "./handler";
import { abortTurn, endTurn, startTurn } from "./running-turns";
import { verifySlackSignature } from "./verify";

function createTestApp() {
  const app = withSlackConfig(new Hono<SlackEnv>());
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

function resetSlackTestState() {
  slackTestState.calls = [];
  slackTestState.postMessageOverride = null;
  slackTestState.updateOverride = null;
  slackTestState.runAgentOverride = null;
  slackTestState.renameOverride = null;
  slackTestState.chatStreamEnabled = true;
  slackTestState.historyImpl = () =>
    Promise.resolve({
      messages: [{ user: "U1", text: "channel message", ts: "1.1" }],
    });
  slackTestState.streamAppendFailAfter = null;
  slackTestState.repliesImpl = () =>
    Promise.resolve({
      messages: [{ user: "U1", text: "test message", ts: "1.1" }],
    });
  // Default to a workspace without agent sessions so the tests below cover
  // the fallback indicators; the session path opts back in explicitly.
  slackTestState.sessionStatusOverride = () => {
    const err = new Error("An API error occurred: feature_disabled");
    Object.assign(err, {
      code: "slack_webapi_platform_error",
      data: { ok: false, error: "feature_disabled" },
    });
    return Promise.reject(err);
  };
  slackTestState.resolveWorkspace = (teamId: string) => {
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
  };
}

describe("handleSlackEvent", () => {
  const app = createTestApp();

  beforeEach(resetSlackTestState);

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

  test("publishes the home view on app_home_opened", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_home_${Date.now()}`,
      event: {
        type: "app_home_opened",
        tab: "home",
        user: "U1",
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));

    const publish = slackTestState.calls.find(
      (m) => m.method === "views.publish",
    );
    expect(publish).toBeDefined();
    expect((publish?.args.view as { type: string }).type).toBe("home");
    expect(publish?.args.user_id).toBe("U1");
  });

  test("ignores app_home_opened for the messages tab", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_home_msgs_${Date.now()}`,
      event: {
        type: "app_home_opened",
        tab: "messages",
        user: "U1",
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(slackTestState.calls.length).toBe(0);
  });

  test("responds once when a mention arrives as app_mention and message", async () => {
    const ts = `${Date.now()}.55`;
    const base = {
      type: "event_callback",
      team_id: "T_KNOWN",
      event: {
        text: "<@UBOT> create an incident",
        user: "U1",
        channel: "C1",
        channel_type: "channel",
        ts,
      },
    };

    // Same underlying message, delivered as two distinct events.
    await signAndPost(app, {
      ...base,
      event_id: `evt_mention_${ts}`,
      event: { ...base.event, type: "app_mention" },
    });
    await signAndPost(app, {
      ...base,
      event_id: `evt_message_${ts}`,
      event: { ...base.event, type: "message" },
    });
    await new Promise((r) => setTimeout(r, 100));

    const thinking = slackTestState.calls.filter(
      (m) => m.method === "postMessage",
    );
    expect(thinking.length).toBe(1);
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

    slackTestState.calls = [];
    await signAndPost(app, body);
    await new Promise((r) => setTimeout(r, 50));

    expect(slackTestState.calls.length).toBe(0);
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
    expect(slackTestState.calls.length).toBe(0);
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
    expect(slackTestState.calls.length).toBe(0);
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
    expect(slackTestState.calls.length).toBe(0);
  });

  test("marks the agent session as processing instead of posting Thinking", async () => {
    slackTestState.sessionStatusOverride = null;
    const ts = `${Date.now()}.60`;

    await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_session_${ts}`,
      event: {
        type: "app_mention",
        text: "<@UBOT> which reports are open?",
        user: "U1",
        channel: "C1",
        ts,
      },
    });
    await new Promise((r) => setTimeout(r, 100));

    const statuses = slackTestState.calls
      .filter((m) => m.method === "agents.sessions.setStatus")
      .map((m) => m.args);
    expect(statuses).toEqual([
      {
        channel_id: "C1",
        thread_ts: ts,
        status: "processing",
        initiator_user_id: "U1",
      },
      { channel_id: "C1", thread_ts: ts, status: "active" },
    ]);

    const posts = slackTestState.calls.filter(
      (m) => m.method === "postMessage",
    );
    expect(posts.length).toBe(1);
    expect(posts[0].args).toMatchObject({
      channel: "C1",
      thread_ts: ts,
      text: "Here is my response",
    });
    expect(slackTestState.calls.some((m) => m.method === "update")).toBe(false);
  });

  test("hands the agent session back as active when runAgent throws", async () => {
    slackTestState.sessionStatusOverride = null;
    slackTestState.runAgentOverride = () =>
      Promise.reject(new Error("agent exploded"));
    const ts = `${Date.now()}.61`;

    await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_session_err_${ts}`,
      event: {
        type: "app_mention",
        text: "<@UBOT> hello",
        user: "U1",
        channel: "C1",
        ts,
      },
    });
    await new Promise((r) => setTimeout(r, 100));

    const errorPost = slackTestState.calls.find(
      (m) =>
        m.method === "postMessage" &&
        typeof m.args.text === "string" &&
        m.args.text.includes("Something went wrong"),
    );
    expect(errorPost).toBeDefined();
    const last = slackTestState.calls
      .filter((m) => m.method === "agents.sessions.setStatus")
      .at(-1);
    expect(last?.args.status).toBe("active");
  });

  test("answers an untagged reply to its own question", async () => {
    const ts = `${Date.now()}.70`;
    slackTestState.repliesImpl = () =>
      Promise.resolve({
        messages: [
          { user: "U1", text: "<@UBOT> update my status page", ts: "5.1" },
          { user: "UBOT", bot_id: "B1", text: "Which page?", ts: "5.2" },
          { user: "U1", text: "acme, id 1", ts },
        ],
      });

    await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_untagged_${ts}`,
      event: {
        type: "message",
        text: "acme, id 1",
        user: "U1",
        channel: "C1",
        channel_type: "channel",
        ts,
        thread_ts: "5.1",
      },
    });
    await new Promise((r) => setTimeout(r, 100));

    const answer = slackTestState.calls.find(
      (m) =>
        (m.method === "update" || m.method === "postMessage") &&
        m.args.text === "Here is my response",
    );
    expect(answer).toBeDefined();
  });

  test("ignores an untagged thread reply that isn't answering the agent", async () => {
    const ts = `${Date.now()}.71`;
    slackTestState.repliesImpl = () =>
      Promise.resolve({
        messages: [
          { user: "U1", text: "<@UBOT> update my status page", ts: "6.1" },
          { user: "UBOT", bot_id: "B1", text: "Which page?", ts: "6.2" },
          { user: "U2", text: "I'll check the logs", ts },
        ],
      });

    await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_untagged_other_${ts}`,
      event: {
        type: "message",
        text: "I'll check the logs",
        user: "U2",
        channel: "C1",
        channel_type: "channel",
        ts,
        thread_ts: "6.1",
      },
    });
    await new Promise((r) => setTimeout(r, 100));

    expect(slackTestState.calls.length).toBe(0);
  });

  test("replies in the agent pane without a mention", async () => {
    const ts = `${Date.now()}.5`;
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_dm_${ts}`,
      event: {
        type: "message",
        text: "which reports are open?",
        user: "U1",
        channel: "D1",
        channel_type: "im",
        ts,
        thread_ts: "1.1",
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));

    const status = slackTestState.calls.find(
      (m) => m.method === "assistant.threads.setStatus",
    );
    expect(status?.args).toMatchObject({ channel_id: "D1", thread_ts: "1.1" });

    // Native status replaces the "Thinking..." placeholder: the answer is
    // a single fresh message in the thread, never an update.
    const posts = slackTestState.calls.filter(
      (m) => m.method === "postMessage",
    );
    expect(posts.length).toBe(1);
    expect(posts[0].args).toMatchObject({
      channel: "D1",
      thread_ts: "1.1",
      text: "Here is my response",
    });
    expect(slackTestState.calls.some((m) => m.method === "update")).toBe(false);
  });

  test("ignores the agent pane thread root and edits", async () => {
    for (const subtype of ["assistant_app_thread", "message_changed"]) {
      const res = await signAndPost(app, {
        type: "event_callback",
        team_id: "T_KNOWN",
        event_id: `evt_dm_${subtype}_${Date.now()}`,
        event: {
          type: "message",
          subtype,
          text: "hello",
          user: "U1",
          channel: "D1",
          channel_type: "im",
          ts: `${Date.now()}.6`,
        },
      });
      expect(res.status).toBe(200);
    }

    await new Promise((r) => setTimeout(r, 50));
    expect(slackTestState.calls.length).toBe(0);
  });

  test("posts the error in the agent pane when runAgent throws", async () => {
    slackTestState.runAgentOverride = () =>
      Promise.reject(new Error("agent exploded"));

    await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_dm_err_${Date.now()}`,
      event: {
        type: "message",
        text: "hello",
        user: "U1",
        channel: "D1",
        channel_type: "im",
        ts: `${Date.now()}.7`,
        thread_ts: "1.1",
      },
    });
    await new Promise((r) => setTimeout(r, 100));

    const errorPost = slackTestState.calls.find(
      (m) =>
        m.method === "postMessage" &&
        typeof m.args.text === "string" &&
        m.args.text.includes("Something went wrong"),
    );
    expect(errorPost).toBeDefined();
  });

  test("greets in the thread on the legacy assistant_thread_started", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_thread_started_${Date.now()}`,
      event: {
        type: "assistant_thread_started",
        assistant_thread: {
          user_id: "U1",
          channel_id: "D1",
          thread_ts: "2.2",
          context: {},
        },
      },
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));

    // The greeting lands in the thread that was just opened, and states the
    // approval guarantee where it matters rather than only in App Home.
    const welcome = slackTestState.calls.find(
      (m) => m.method === "postMessage",
    );
    expect(welcome?.args).toMatchObject({ channel: "D1", thread_ts: "2.2" });
    expect(welcome?.args.text as string).toContain("Approve");
    expect((welcome?.args.blocks as unknown[]).length).toBeGreaterThan(0);
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
    expect(slackTestState.calls.length).toBe(0);
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
    expect(slackTestState.calls.length).toBe(0);
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
    expect(slackTestState.calls.length).toBe(0);
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
    expect(slackTestState.calls.length).toBe(0);
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
    expect(slackTestState.calls.length).toBe(0);
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
    expect(slackTestState.calls.length).toBe(0);
  });

  test("ignores events with no event payload", async () => {
    const res = await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_noevent_${Date.now()}`,
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(slackTestState.calls.length).toBe(0);
  });

  test("falls back to top-level message on cannot_reply_to_message", async () => {
    let callCount = 0;
    slackTestState.postMessageOverride = (args: Record<string, unknown>) => {
      callCount++;
      if (callCount === 1) {
        const err = new Error("An API error occurred: cannot_reply_to_message");
        Object.assign(err, {
          code: "slack_webapi_platform_error",
          data: { ok: false, error: "cannot_reply_to_message" },
        });
        return Promise.reject(err);
      }
      slackTestState.calls.push({ method: "postMessage", args });
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

    const fallbackPost = slackTestState.calls.find(
      (m) => m.method === "postMessage" && !m.args.thread_ts,
    );
    expect(fallbackPost).toBeDefined();
  });

  test("returns early on non-recoverable postMessage error", async () => {
    slackTestState.postMessageOverride = () => {
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

    const updateMessages = slackTestState.calls.filter(
      (m) => m.method === "update",
    );
    expect(updateMessages.length).toBe(0);
  });

  test("shows error message when runAgent throws", async () => {
    slackTestState.runAgentOverride = () =>
      Promise.reject(new Error("agent exploded"));

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

    // Delivered as a fresh message when streaming, or by overwriting the
    // "Thinking..." placeholder when it isn't — either way the user sees it.
    const errorMessage = slackTestState.calls.find(
      (m) =>
        (m.method === "update" || m.method === "postMessage") &&
        typeof m.args.text === "string" &&
        m.args.text.includes("Something went wrong"),
    );
    expect(errorMessage).toBeDefined();
  });

  test("does not throw when both runAgent and error update fail", async () => {
    slackTestState.runAgentOverride = () =>
      Promise.reject(new Error("agent exploded"));
    slackTestState.updateOverride = () => {
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

describe("looksLikeUncardedDraft", () => {
  test("flags a prose draft that ends by asking permission", () => {
    expect(
      looksLikeUncardedDraft(
        `There's one status page ("Inter.link"). Here's the draft incident report I'll create:

**Title:** Traffic Forwarding Issue – POP FRA1-DE
**Status:** Investigating
**Message:** We are currently investigating a traffic forwarding issue.

Shall I go ahead and publish this, or would you like to adjust anything?`,
      ),
    ).toBe(true);
  });

  test("flags the other permission phrasings", () => {
    const draft = "*Title:* API outage\n*Message:* We're on it.\n";
    expect(looksLikeUncardedDraft(`${draft}Want me to create this?`)).toBe(
      true,
    );
    expect(
      looksLikeUncardedDraft(`${draft}Would you like me to post it now?`),
    ).toBe(true);
  });

  test("ignores a plain answer that happens to end in a question", () => {
    expect(
      looksLikeUncardedDraft(
        "You have no active incidents. Want me to create one?",
      ),
    ).toBe(false);
  });

  test("ignores a listing with field labels but no permission question", () => {
    expect(
      looksLikeUncardedDraft(
        "*Title:* API outage\n*Status:* investigating\n*Message:* We're on it.",
      ),
    ).toBe(false);
  });

  test("ignores empty text", () => {
    expect(looksLikeUncardedDraft("")).toBe(false);
  });
});

describe("isAnswerToAgent", () => {
  const starter = { user: "U1", text: "<@UBOT> open an incident", ts: "1" };
  const question = { user: "UBOT", bot_id: "B1", text: "Which page?", ts: "2" };

  test("answers the session starter replying right after the agent", () => {
    const thread = [starter, question, { user: "U1", text: "API", ts: "3" }];
    expect(isAnswerToAgent(thread, { ts: "3", user: "U1" }, "UBOT")).toBe(true);
  });

  test("ignores someone other than the session starter", () => {
    const thread = [starter, question, { user: "U2", text: "API", ts: "3" }];
    expect(isAnswerToAgent(thread, { ts: "3", user: "U2" }, "UBOT")).toBe(
      false,
    );
  });

  test("ignores the starter once a human spoke after the agent", () => {
    const thread = [
      starter,
      question,
      { user: "U2", text: "it's the API", ts: "3" },
      { user: "U1", text: "yes, the API", ts: "4" },
    ];
    expect(isAnswerToAgent(thread, { ts: "4", user: "U1" }, "UBOT")).toBe(
      false,
    );
  });

  test("ignores threads where the agent was never mentioned", () => {
    const thread = [
      { user: "U1", text: "anyone seeing errors?", ts: "1" },
      question,
      { user: "U1", text: "API", ts: "3" },
    ];
    expect(isAnswerToAgent(thread, { ts: "3", user: "U1" }, "UBOT")).toBe(
      false,
    );
  });

  test("ignores other bots' messages as the previous message", () => {
    const thread = [
      starter,
      { user: "UOTHER", bot_id: "B2", text: "Deploy finished", ts: "2" },
      { user: "U1", text: "API", ts: "3" },
    ];
    expect(isAnswerToAgent(thread, { ts: "3", user: "U1" }, "UBOT")).toBe(
      false,
    );
  });
});

describe("streaming the agent's answer", () => {
  const app = createTestApp();

  beforeEach(resetSlackTestState);

  /** Drives the agent mock's `events` so the handler sees a real stream. */
  function streamTurn(
    drive: (events: {
      onTextDelta(delta: string): Promise<void>;
      onToolCall(c: { id: string; toolName: string }): Promise<void>;
      onToolResult(r: { id: string; toolName: string }): Promise<void>;
    }) => Promise<void>,
    text = "All five monitors are healthy.",
  ) {
    slackTestState.runAgentOverride = async (options: unknown) => {
      // biome-ignore lint/suspicious/noExplicitAny: test double plumbing
      await drive((options as any).events);
      return {
        text,
        toolResults: [],
        finishReason: "stop",
        stepCount: 1,
        hitStepLimit: false,
        aborted: false,
      };
    };
  }

  function mention(suffix: string) {
    return signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_stream_${suffix}`,
      event: {
        type: "app_mention",
        text: "<@UBOT> what's broken?",
        user: "U1",
        channel: "C1",
        ts: `${Date.now()}.${suffix}`,
      },
    });
  }

  test("streams the answer instead of posting it", async () => {
    streamTurn(async (events) => {
      await events.onTextDelta("All five monitors ");
      await events.onTextDelta("are healthy.");
    });

    const res = await mention("1");
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));

    const appended = slackTestState.calls
      .filter((m) => m.method === "stream.append")
      .map((m) => m.args.markdown_text);
    expect(appended).toEqual(["All five monitors ", "are healthy."]);

    // The stream carried the answer, so it is finalized rather than re-posted.
    expect(slackTestState.calls.some((m) => m.method === "stream.stop")).toBe(
      true,
    );
    expect(slackTestState.calls.some((m) => m.method === "postMessage")).toBe(
      false,
    );
  });

  test("reports each tool call as a task", async () => {
    streamTurn(async (events) => {
      await events.onToolCall({ id: "t1", toolName: "list_status_pages" });
      await events.onToolResult({ id: "t1", toolName: "list_status_pages" });
      await events.onTextDelta("Done.");
    });

    await mention("2");
    await new Promise((r) => setTimeout(r, 100));

    const tasks = slackTestState.calls
      .filter((m) => m.method === "stream.append" && m.args.chunks)
      .flatMap((m) => m.args.chunks as Record<string, unknown>[]);
    expect(tasks).toEqual([
      {
        type: "task_update",
        id: "t1",
        title: "Reading status pages",
        status: "in_progress",
      },
      {
        type: "task_update",
        id: "t1",
        title: "Reading status pages",
        status: "complete",
      },
    ]);
  });

  test("falls back to the placeholder when the workspace has no streaming", async () => {
    slackTestState.chatStreamEnabled = false;
    streamTurn(async () => {});

    await mention("3");
    await new Promise((r) => setTimeout(r, 100));

    // No agent session and no stream leaves the oldest path: a "Thinking..."
    // message posted up front and overwritten with the answer.
    const placeholder = slackTestState.calls.find(
      (m) => m.method === "postMessage",
    );
    expect(placeholder?.args.text).toContain("Thinking...");
    const answer = slackTestState.calls.find((m) => m.method === "update");
    expect(answer?.args.text).toBe("All five monitors are healthy.");
    expect(slackTestState.calls.some((m) => m.method === "chatStream")).toBe(
      false,
    );
  });

  test("rewrites the partial message when the stream breaks mid-turn", async () => {
    // The first append lands, the second fails — Slack is left holding half
    // an answer, so the whole answer has to replace it.
    slackTestState.streamAppendFailAfter = 1;
    streamTurn(async (events) => {
      await events.onTextDelta("All five ");
      await events.onTextDelta("monitors are healthy.");
    });

    await mention("4");
    await new Promise((r) => setTimeout(r, 100));

    const rewrite = slackTestState.calls.find((m) => m.method === "update");
    expect(rewrite?.args).toMatchObject({
      channel: "C1",
      ts: "stream.ts",
      text: "All five monitors are healthy.",
    });
    // Nothing is posted alongside it: one message, one answer.
    expect(slackTestState.calls.some((m) => m.method === "postMessage")).toBe(
      false,
    );
  });

  test("names tasks after the tool's verb", () => {
    expect(toolTaskTitle("list_status_pages")).toBe("Reading status pages");
    expect(toolTaskTitle("get_monitor_status")).toBe("Reading monitor status");
    expect(toolTaskTitle("create_status_report")).toBe(
      "Drafting status report",
    );
    expect(toolTaskTitle("search_docs")).toBe("Searching docs");
    // An unknown verb still reads as words rather than a tool name.
    expect(toolTaskTitle("frobnicate_widgets")).toBe("frobnicate widgets");
    expect(toolTaskTitle("ping")).toBe("ping");
  });
});

describe("running turns", () => {
  test("aborts only the thread it was asked about", () => {
    const turn = startTurn("C_RT", "1.1");
    expect(abortTurn("C_RT", "9.9")).toBe(false);
    expect(turn.signal.aborted).toBe(false);

    expect(abortTurn("C_RT", "1.1")).toBe(true);
    expect(turn.signal.aborted).toBe(true);

    endTurn("C_RT", "1.1", turn);
    expect(abortTurn("C_RT", "1.1")).toBe(false);
  });

  test("a finished turn does not deregister the one that replaced it", () => {
    const first = startTurn("C_RT2", "2.2");
    const second = startTurn("C_RT2", "2.2");
    endTurn("C_RT2", "2.2", first);

    expect(abortTurn("C_RT2", "2.2")).toBe(true);
    expect(second.signal.aborted).toBe(true);
    endTurn("C_RT2", "2.2", second);
  });
});

describe("stopping a turn", () => {
  const app = createTestApp();

  beforeEach(() => {
    resetSlackTestState();
    // A workspace with agent sessions — the surface the stop button lives on.
    slackTestState.sessionStatusOverride = null;
  });

  function stopEvent(channel: string, threadTs: string) {
    return signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_stop_${channel}_${threadTs}`,
      event: {
        type: "agent_session_stopped",
        channel,
        thread_ts: threadTs,
        user: "U1",
        streaming_message_ts: [],
        event_ts: "1.1",
      },
    });
  }

  function activeStatusCalls() {
    return slackTestState.calls.filter(
      (m) =>
        m.method === "agents.sessions.setStatus" && m.args.status === "active",
    );
  }

  test("aborts the run, confirms the stop, and clears the status", async () => {
    let signal: AbortSignal | undefined;
    slackTestState.runAgentOverride = (options: unknown) => {
      signal = (options as { signal: AbortSignal }).signal;
      return new Promise((resolve) => {
        signal?.addEventListener("abort", () =>
          resolve({
            text: "Looking at the API monit",
            toolResults: [],
            finishReason: "abort",
            stepCount: 0,
            hitStepLimit: false,
            aborted: true,
          }),
        );
      });
    };

    const ts = "6001.1";
    await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_stopme_${ts}`,
      event: {
        type: "app_mention",
        text: "<@UBOT> what's broken?",
        user: "U1",
        channel: "C_STOP",
        ts,
      },
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(signal).toBeDefined();
    expect(signal?.aborted).toBe(false);

    await stopEvent("C_STOP", ts);
    await new Promise((r) => setTimeout(r, 100));

    expect(signal?.aborted).toBe(true);
    expect(activeStatusCalls().length).toBeGreaterThan(0);

    const notice = slackTestState.calls.find(
      (m) =>
        m.method === "postMessage" &&
        typeof m.args.text === "string" &&
        m.args.text.includes("Stopped"),
    );
    expect(notice).toBeDefined();

    // The half-written answer is never delivered as if it were finished.
    const answer = slackTestState.calls.find(
      (m) =>
        typeof m.args.text === "string" &&
        m.args.text.includes("Looking at the API monit"),
    );
    expect(answer).toBeUndefined();
  });

  test("clears the status even when no turn is running here", async () => {
    await stopEvent("C_STOP2", "7001.1");
    await new Promise((r) => setTimeout(r, 50));

    // Nothing to abort — another instance may hold the turn — but the user
    // still has to get out of the loading state.
    expect(activeStatusCalls()).toHaveLength(1);
    expect(activeStatusCalls()[0].args).toMatchObject({
      channel_id: "C_STOP2",
      thread_ts: "7001.1",
    });
  });
});

describe("titling a thread", () => {
  const app = createTestApp();
  const redisStore = (globalThis as Record<string, unknown>)
    .__testRedisStore as Map<string, string>;

  beforeEach(() => {
    resetSlackTestState();
    redisStore.clear();
  });

  function renameCalls() {
    return slackTestState.calls.filter(
      (m) => m.method === "agents.sessions.rename",
    );
  }

  function paneMessage(ts: string, text: string, threadTs?: string) {
    return signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_title_${ts}`,
      event: {
        type: "message",
        channel_type: "im",
        text,
        user: "U1",
        channel: "D_TITLE",
        ts,
        ...(threadTs ? { thread_ts: threadTs } : {}),
      },
    });
  }

  test("names the pane thread after what the user asked", async () => {
    await paneMessage("8001.1", "which reports are currently open?");
    await new Promise((r) => setTimeout(r, 100));

    expect(renameCalls()).toHaveLength(1);
    expect(renameCalls()[0].args).toMatchObject({
      channel_id: "D_TITLE",
      thread_ts: "8001.1",
      title: "which reports are currently open?",
    });
  });

  test("names it once and leaves it alone after that", async () => {
    await paneMessage("8002.1", "is the checkout monitor healthy?");
    await new Promise((r) => setTimeout(r, 100));
    expect(renameCalls()).toHaveLength(1);

    // A second turn on the same thread: the subject hasn't changed, and the
    // name shouldn't follow whatever was asked next.
    await paneMessage("8002.2", "and what about billing?", "8002.1");
    await new Promise((r) => setTimeout(r, 100));
    expect(renameCalls()).toHaveLength(1);
  });

  test("stops renaming once a person has named it", async () => {
    await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: "evt_renamed_8003",
      event: {
        type: "agent_session_title_changed",
        channel: "D_TITLE",
        thread_ts: "8003.1",
        user: "U1",
        title: "Tuesday's Stripe outage",
        event_ts: "1.1",
      },
    });
    await new Promise((r) => setTimeout(r, 50));

    await paneMessage("8003.2", "any update on this?", "8003.1");
    await new Promise((r) => setTimeout(r, 100));

    expect(renameCalls()).toHaveLength(0);
  });

  test("leaves channel threads alone", async () => {
    // `agents.sessions.rename` also renames the channel for session channels —
    // not worth risking on a shared incident channel for a name nobody lists.
    await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: "evt_title_channel",
      event: {
        type: "app_mention",
        text: "<@UBOT> what's broken?",
        user: "U1",
        channel: "C_TITLE",
        ts: "8004.1",
      },
    });
    await new Promise((r) => setTimeout(r, 100));

    expect(renameCalls()).toHaveLength(0);
  });

  test("keeps the answer when renaming fails", async () => {
    slackTestState.renameOverride = () =>
      Promise.reject(new Error("feature_disabled"));

    await paneMessage("8005.1", "which reports are open?");
    await new Promise((r) => setTimeout(r, 100));

    const answered = slackTestState.calls.some(
      (m) =>
        typeof m.args.text === "string" &&
        m.args.text.includes("Here is my response"),
    );
    expect(answered).toBe(true);
    // A failed rename must not mark the thread as named.
    expect(redisStore.has("slack:title:D_TITLE:8005.1")).toBe(false);
  });
});

describe("greeting on first contact", () => {
  const app = createTestApp();
  const redisStore = (globalThis as Record<string, unknown>)
    .__testRedisStore as Map<string, string>;

  beforeEach(() => {
    resetSlackTestState();
    redisStore.clear();
  });

  function homeOpened(tab: string, userId = "U1") {
    return signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_home_${tab}_${userId}_${Math.random()}`,
      event: {
        type: "app_home_opened",
        user: userId,
        channel: "D_WELCOME",
        tab,
        event_ts: "1.1",
      },
    });
  }

  function welcomes() {
    return slackTestState.calls.filter(
      (m) =>
        m.method === "postMessage" &&
        typeof m.args.text === "string" &&
        m.args.text.includes("Approve"),
    );
  }

  test("greets when the Messages tab is opened", async () => {
    await homeOpened("messages");
    await new Promise((r) => setTimeout(r, 50));

    expect(welcomes()).toHaveLength(1);
    // Top-level in the DM: the agent experience has no thread to greet into.
    expect(welcomes()[0].args.thread_ts).toBeUndefined();
  });

  test("greets a person once, however often they open it", async () => {
    await homeOpened("messages");
    await new Promise((r) => setTimeout(r, 50));
    await homeOpened("messages");
    await new Promise((r) => setTimeout(r, 50));

    expect(welcomes()).toHaveLength(1);
  });

  test("greets each person separately", async () => {
    await homeOpened("messages", "U1");
    await new Promise((r) => setTimeout(r, 50));
    await homeOpened("messages", "U2");
    await new Promise((r) => setTimeout(r, 50));

    expect(welcomes()).toHaveLength(2);
  });

  test("publishes the home view on the Home tab without greeting", async () => {
    await homeOpened("home");
    await new Promise((r) => setTimeout(r, 50));

    expect(slackTestState.calls.some((m) => m.method === "views.publish")).toBe(
      true,
    );
    expect(welcomes()).toHaveLength(0);
  });

  test("does not mark someone greeted when the greeting fails", async () => {
    slackTestState.postMessageOverride = () =>
      Promise.reject(new Error("channel_not_found"));

    await homeOpened("messages");
    await new Promise((r) => setTimeout(r, 50));

    // Otherwise a transient failure costs them the greeting permanently.
    expect(redisStore.has("slack:greeted:T_KNOWN:U1")).toBe(false);
  });
});

describe("the channel the user is viewing", () => {
  const app = createTestApp();
  const redisStore = (globalThis as Record<string, unknown>)
    .__testRedisStore as Map<string, string>;

  beforeEach(() => {
    resetSlackTestState();
    redisStore.clear();
  });

  function contextChanged(
    entities: Array<Record<string, string>> | undefined,
    userId = "U1",
  ) {
    return signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: `evt_ctx_${userId}_${Math.random()}`,
      event: {
        type: "app_context_changed",
        context: entities ? { entities } : {},
      },
      authorizations: [
        { user_id: "B0", is_bot: true },
        { user_id: userId, is_bot: false },
      ],
    });
  }

  /** Captures what the handler handed the agent for this turn. */
  function captureAgentOptions() {
    const seen: { tools?: Record<string, unknown>; contextNote?: string }[] =
      [];
    slackTestState.runAgentOverride = (options: unknown) => {
      seen.push(options as { contextNote?: string });
      return Promise.resolve({
        text: "Here is my response",
        toolResults: [],
        finishReason: "stop",
        stepCount: 1,
        hitStepLimit: false,
        aborted: false,
      });
    };
    return seen;
  }

  test("remembers it for the authorizing human", async () => {
    await contextChanged([
      { type: "slack#/types/channel_id", value: "C_INCIDENT" },
    ]);
    await new Promise((r) => setTimeout(r, 50));

    expect(redisStore.get("slack:context:T_KNOWN:U1")).toBe("C_INCIDENT");
    // Never attributed to the bot authorization.
    expect(redisStore.has("slack:context:T_KNOWN:B0")).toBe(false);
  });

  test("forgets it when the context empties", async () => {
    await contextChanged([
      { type: "slack#/types/channel_id", value: "C_INCIDENT" },
    ]);
    await new Promise((r) => setTimeout(r, 50));
    await contextChanged(undefined);
    await new Promise((r) => setTimeout(r, 50));

    // A channel they left is worse than no context at all.
    expect(redisStore.has("slack:context:T_KNOWN:U1")).toBe(false);
  });

  test("offers the channel to the agent on a pane turn", async () => {
    await contextChanged([
      { type: "slack#/types/channel_id", value: "C_INCIDENT" },
    ]);
    await new Promise((r) => setTimeout(r, 50));

    const seen = captureAgentOptions();
    await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: "evt_ctx_turn",
      event: {
        type: "message",
        channel_type: "im",
        text: "draft an update for this",
        user: "U1",
        channel: "D_CTX",
        ts: "9101.1",
      },
    });
    await new Promise((r) => setTimeout(r, 100));

    expect(seen).toHaveLength(1);
    expect(seen[0].contextNote).toContain("<#C_INCIDENT>");
    expect(Object.keys(seen[0].tools ?? {})).toContain("read_slack_channel");
    // Nothing is read until the model decides the request calls for it.
    expect(
      slackTestState.calls.some((m) => m.method === "conversations.history"),
    ).toBe(false);
  });

  test("leaves channel turns alone", async () => {
    await contextChanged([
      { type: "slack#/types/channel_id", value: "C_INCIDENT" },
    ]);
    await new Promise((r) => setTimeout(r, 50));

    const seen = captureAgentOptions();
    await signAndPost(app, {
      type: "event_callback",
      team_id: "T_KNOWN",
      event_id: "evt_ctx_channel_turn",
      event: {
        type: "app_mention",
        text: "<@UBOT> what's broken?",
        user: "U1",
        channel: "C_OTHER",
        ts: "9102.1",
      },
    });
    await new Promise((r) => setTimeout(r, 100));

    // In a channel the agent already has the thread it was called into.
    expect(seen).toHaveLength(1);
    expect(seen[0].contextNote).toBeUndefined();
    expect(seen[0].tools).toBeUndefined();
  });
});
