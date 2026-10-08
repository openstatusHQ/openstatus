import crypto from "node:crypto";

import { and, db, eq, inArray } from "@openstatus/db";
import {
  auditLog,
  incident,
  incidentEvent,
  selectWorkspaceSchema,
  slackUser,
  user,
  usersToWorkspaces,
  workspace as workspaceTable,
} from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createPage,
  createTestWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { declareIncident } from "@openstatus/services/incident";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "@openstatus/test-utils";
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
  // The seeded member of workspace 1, so the clicking user is linked.
  slackTestState.usersInfoImpl = () =>
    Promise.resolve({
      ok: true,
      user: { profile: { email: "ping@openstatus.dev" } },
    });
  slackTestState.resolveWorkspace = (teamId: string) =>
    teamId === "T_KNOWN"
      ? Promise.resolve({
          botToken: "xoxb-fallback",
          workspace: { id: 1, limits: { "slack-agent": true } },
        })
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
        ? Promise.resolve({
            botToken: "xoxb-fresh",
            workspace: { id: 1, limits: { "slack-agent": true } },
          })
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
      Promise.resolve({
        botToken: "xoxb-other",
        workspace: { id: 2, limits: { "slack-agent": true } },
      });

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

describe("handleSlackInteraction (members only)", () => {
  const app = createTestApp();

  beforeEach(() => {
    configureSlackDoubles();
    redisStore.clear();
    slackTestState.usersInfoImpl = () =>
      Promise.resolve({ ok: true, user: { profile: {} } });
  });

  function seedUnlinked(id: string, slackUserId: string) {
    const data = { ...seedCreateMaintenance(id), userId: slackUserId };
    redisStore.set(`slack:action:${id}`, JSON.stringify(data));
  }

  test("an unlinked approver gets the link card and the draft stays live", async () => {
    const slackUserId = `U_UNLINKED_${crypto.randomUUID()}`;
    seedUnlinked("maint-unlinked", slackUserId);
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: slackUserId },
      channel: { id: "C1" },
      message: { ts: "2.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_maint-unlinked" }],
    });
    expect(res.status).toBe(200);
    expect(redisStore.has("slack:action:maint-unlinked")).toBe(true);
    const ephemeral = slackTestState.calls.find(
      (c) => c.method === "postEphemeral",
    );
    expect(ephemeral?.args.text).toContain("Link your openstatus account");
    expect(slackTestState.calls.some((c) => c.method === "update")).toBe(false);
  });

  test("an unlinked initiator can still cancel their own draft", async () => {
    const slackUserId = `U_UNLINKED_${crypto.randomUUID()}`;
    seedUnlinked("maint-unlinked-cancel", slackUserId);
    const res = await signAndPost(app, {
      type: "block_actions",
      user: { id: slackUserId },
      channel: { id: "C1" },
      message: { ts: "2.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "cancel_maint-unlinked-cancel" }],
    });
    expect(res.status).toBe(200);
    expect(redisStore.has("slack:action:maint-unlinked-cancel")).toBe(false);
    const cancelled = slackTestState.calls.find(
      (c) =>
        c.method === "update" && c.args.text === ":no_entry_sign: Cancelled.",
    );
    expect(cancelled).toBeDefined();
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

  test("a confirmed action is attributed to the member with the Slack email", async () => {
    const { workspace } = await createTestWorkspace();
    const page = await createPage(workspace.id);
    const member = await createUser();
    await addUserToWorkspace(member.id, workspace.id, "member");
    slackTestState.resolveWorkspace = () =>
      Promise.resolve({
        botToken: "xoxb-fallback",
        workspace: { id: workspace.id, limits: { "slack-agent": true } },
      });
    slackTestState.usersInfoImpl = () =>
      Promise.resolve({
        ok: true,
        user: { profile: { email: (member.email as string).toUpperCase() } },
      });

    const now = Date.now();
    const data = {
      ...basePending,
      id: "maint-attr",
      workspaceId: workspace.id,
      threadTs: "3.1",
      messageTs: "3.2",
      payload: {
        toolName: "create_maintenance",
        input: {
          title: "DB Maintenance",
          message: "Scheduled database upgrade.",
          from: new Date(now + 86400000).toISOString(),
          to: new Date(now + 86400000 + 3600000).toISOString(),
          pageId: page.id,
          pageComponentIds: [],
        },
      },
    };
    redisStore.set("slack:action:maint-attr", JSON.stringify(data));
    redisStore.set("slack:thread:3.1", "maint-attr");

    try {
      const res = await signAndPost(app, {
        type: "block_actions",
        user: { id: "U_OWNER" },
        channel: { id: "C1" },
        message: { ts: "3.2" },
        team: { id: "T_KNOWN" },
        actions: [{ action_id: "approve_maint-attr" }],
      });
      expect(res.status).toBe(200);

      // The verb ran with the matched member, so its audit row carries it.
      const created = await db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.workspaceId, workspace.id),
            eq(auditLog.action, "maintenance.create"),
          ),
        )
        .get();
      expect(created?.actorType).toBe("slack");
      expect(created?.actorUserId).toBe(member.id);
    } finally {
      await db.delete(auditLog).where(eq(auditLog.workspaceId, workspace.id));
    }
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

describe("link this channel button", () => {
  const app = createTestApp();

  beforeEach(() => {
    configureSlackDoubles();
    redisStore.clear();
  });

  test("binds the channel to the incident as the clicking member", async () => {
    const workspace = selectWorkspaceSchema.parse(
      await db.query.workspace.findFirst({ where: eq(workspaceTable.id, 1) }),
    );
    const created = await declareIncident({
      ctx: { workspace, actor: { type: "system", job: "test" } },
      input: { title: "Bind me", severity: "minor" },
    });
    const channelId = `C_BIND_${crypto.randomUUID()}`;
    try {
      const res = await signAndPost(app, {
        type: "block_actions",
        user: { id: "U_OWNER" },
        channel: { id: channelId },
        message: { ts: "9.9" },
        team: { id: "T_KNOWN" },
        actions: [
          { action_id: `incident_bind_${created.id}`, value: channelId },
        ],
      });
      expect(res.status).toBe(200);
      const row = await db
        .select()
        .from(incident)
        .where(eq(incident.id, created.id))
        .get();
      expect(row?.slackChannelId).toBe(channelId);
      expect(
        slackTestState.calls.some(
          (c) =>
            c.method === "update" && String(c.args.text).includes("linked"),
        ),
      ).toBe(true);
    } finally {
      await db
        .delete(auditLog)
        .where(
          and(
            eq(auditLog.entityType, "incident"),
            eq(auditLog.entityId, String(created.id)),
          ),
        );
      await db
        .delete(incidentEvent)
        .where(eq(incidentEvent.incidentId, created.id));
      await db.delete(incident).where(eq(incident.id, created.id));
    }
  });
});

describe("declare incident modal", () => {
  const app = createTestApp();

  beforeEach(() => {
    configureSlackDoubles();
    redisStore.clear();
  });

  function submission(values: Record<string, unknown>, metadata = "{}") {
    return {
      type: "view_submission",
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
      view: {
        callback_id: "declare_incident",
        private_metadata: metadata,
        state: { values },
      },
    };
  }

  test("the global shortcut opens the form", async () => {
    const res = await signAndPost(app, {
      type: "shortcut",
      callback_id: "declare_incident",
      trigger_id: "trig-1",
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
    });
    expect(res.status).toBe(200);
    const open = slackTestState.calls.find((c) => c.method === "views.open");
    expect(open).toBeDefined();
    expect(open?.args.trigger_id).toBe("trig-1");
    const view = open?.args.view as Record<string, unknown>;
    expect(view.callback_id).toBe("declare_incident");
    expect(JSON.stringify(view.blocks)).toContain('"initial_user":"U_OWNER"');
  });

  test("the message shortcut prefills the summary", async () => {
    await signAndPost(app, {
      type: "message_action",
      callback_id: "declare_incident_from_message",
      trigger_id: "trig-2",
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
      channel: { id: "C_ORIGIN" },
      message: { text: "checkout is throwing 500s" },
    });
    const open = slackTestState.calls.find((c) => c.method === "views.open");
    expect(open).toBeDefined();
    const view = open?.args.view as Record<string, unknown>;
    expect(view.private_metadata).toBe(
      JSON.stringify({ channelId: "C_ORIGIN" }),
    );
    expect(JSON.stringify(view.blocks)).toContain("checkout is throwing 500s");
  });

  test("an unlinked user gets the link card instead of the form", async () => {
    slackTestState.usersInfoImpl = () =>
      Promise.resolve({ ok: true, user: { profile: {} } });
    await signAndPost(app, {
      type: "shortcut",
      callback_id: "declare_incident",
      trigger_id: "trig-3",
      team: { id: "T_KNOWN" },
      user: { id: "U_STRANGER" },
    });
    const open = slackTestState.calls.find((c) => c.method === "views.open");
    expect(open).toBeDefined();
    const view = open?.args.view as Record<string, unknown>;
    expect(view.callback_id).toBeUndefined();
    expect(JSON.stringify(view.blocks)).toContain("Link account");
  });

  test("the home tab button opens the form", async () => {
    await signAndPost(app, {
      type: "block_actions",
      trigger_id: "trig-home",
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
      actions: [{ action_id: "open_declare_incident" }],
    });
    const open = slackTestState.calls.find((c) => c.method === "views.open");
    expect(open).toBeDefined();
    expect(open?.args.trigger_id).toBe("trig-home");
    const view = open?.args.view as { callback_id?: string };
    expect(view.callback_id).toBe("declare_incident");
  });

  test("a blank title is rejected on the form", async () => {
    const res = await signAndPost(
      app,
      submission({
        title: { value: { value: "  " } },
        severity: { value: { selected_option: { value: "major" } } },
      }),
    );
    expect(await res.json()).toEqual({
      response_action: "errors",
      errors: { title: "Give the incident a title." },
    });
  });

  test("submitting declares the incident and closes the form", async () => {
    const title = `Modal ${crypto.randomUUID()}`;
    const res = await signAndPost(
      app,
      submission(
        {
          title: { value: { value: title } },
          severity: { value: { selected_option: { value: "critical" } } },
          summary: { value: { value: "Checkout is down" } },
          commander: { value: { selected_user: "U_OWNER" } },
        },
        JSON.stringify({ channelId: "C_ORIGIN" }),
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
    const row = await db
      .select()
      .from(incident)
      .where(eq(incident.title, title))
      .get();
    try {
      expect(row?.severity).toBe("critical");
      expect(row?.summary).toBe("Checkout is down");
      expect(row?.workspaceId).toBe(1);
      const ephemeral = slackTestState.calls.find(
        (c) => c.method === "postEphemeral",
      );
      expect(ephemeral?.args.channel).toBe("C_ORIGIN");
      expect(String(ephemeral?.args.text)).toContain(title);
    } finally {
      if (row) {
        await db
          .delete(auditLog)
          .where(
            and(
              eq(auditLog.entityType, "incident"),
              eq(auditLog.entityId, String(row.id)),
            ),
          );
        await db
          .delete(incidentEvent)
          .where(eq(incidentEvent.incidentId, row.id));
        await db.delete(incident).where(eq(incident.id, row.id));
      }
    }
  });
});

/** Drops an incident's events and the audit rows they wrote (no FK on those). */
async function deleteIncidentEvents(incidentId: number) {
  const events = await db
    .select({ id: incidentEvent.id })
    .from(incidentEvent)
    .where(eq(incidentEvent.incidentId, incidentId))
    .all();
  if (events.length > 0) {
    await db.delete(auditLog).where(
      and(
        eq(auditLog.entityType, "incident_event"),
        inArray(
          auditLog.entityId,
          events.map((e) => String(e.id)),
        ),
      ),
    );
  }
  await db
    .delete(incidentEvent)
    .where(eq(incidentEvent.incidentId, incidentId));
}

describe("add to incident timeline shortcut", () => {
  const app = createTestApp();
  const realFetch = globalThis.fetch;
  let replies: { text?: string; blocks?: unknown[] }[];
  let incidentId: number;
  let channelId: string;

  beforeEach(async () => {
    configureSlackDoubles();
    redisStore.clear();
    slackTestState.resolveWorkspace = (teamId: string) =>
      teamId === "T_KNOWN"
        ? Promise.resolve({
            botToken: "xoxb-fallback",
            botUserId: "UBOT",
            workspace: { id: 1, limits: { "slack-agent": true } },
          })
        : Promise.resolve(null);
    slackTestState.reactionsGetImpl = () =>
      Promise.resolve({ ok: true, message: {} });
    slackTestState.conversationsInfoImpl = () =>
      Promise.resolve({ ok: true, channel: {} });
    replies = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://hooks.slack.test/response");
      replies.push(JSON.parse(String(init?.body)));
      return Promise.resolve(new Response("ok"));
    }) as typeof fetch;
    channelId = `C_TIMELINE_${crypto.randomUUID()}`;
    const [row] = await db
      .insert(incident)
      .values({
        workspaceId: 1,
        title: "Timeline incident",
        severity: "major",
        declaredAt: new Date(),
        startedAt: new Date(),
        slackTeamId: "T_KNOWN",
        slackChannelId: channelId,
      })
      .returning();
    incidentId = row.id;
  });

  afterEach(async () => {
    globalThis.fetch = realFetch;
    await deleteIncidentEvents(incidentId);
    await db.delete(incident).where(eq(incident.id, incidentId));
  });

  async function notes() {
    return db
      .select()
      .from(incidentEvent)
      .where(eq(incidentEvent.incidentId, incidentId))
      .all();
  }

  function addToTimeline(
    message: Record<string, unknown>,
    opts: { user?: string; channel?: string } = {},
  ) {
    return signAndPost(app, {
      type: "message_action",
      callback_id: "add_to_incident_timeline",
      trigger_id: "trig-timeline",
      response_url: "https://hooks.slack.test/response",
      team: { id: "T_KNOWN" },
      user: { id: opts.user ?? "U1" },
      channel: { id: opts.channel ?? channelId },
      message,
    });
  }

  function reacted() {
    return slackTestState.calls.some((c) => c.method === "reactions.add");
  }

  test("copies the message onto the timeline and confirms with ✅", async () => {
    const res = await addToTimeline({
      ts: "500.1",
      text: "Rolled back to v41",
      user: "U2",
    });
    expect(res.status).toBe(200);
    const rows = await notes();
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toContain("Rolled back to v41");
    expect(rows[0].message).toContain("https://slack.test/archives/");
    const reaction = slackTestState.calls.find(
      (c) => c.method === "reactions.add",
    );
    expect(reaction?.args).toMatchObject({
      channel: channelId,
      timestamp: "500.1",
      name: "white_check_mark",
    });
    expect(replies).toHaveLength(0);
  });

  test("rich_text wins over mrkdwn: emoji, styles, mentions and channels", async () => {
    // U1 runs the shortcut and must stay linked; U9 has no email, so the
    // profile name is the only thing we know about them.
    slackTestState.usersInfoImpl = (args) =>
      Promise.resolve(
        args.user === "U9"
          ? { ok: true, user: { real_name: "Jane Doe", profile: {} } }
          : { ok: true, user: { profile: { email: "ping@openstatus.dev" } } },
      );
    slackTestState.conversationsInfoImpl = () =>
      Promise.resolve({ ok: true, channel: { name: "inc-db" } });
    await addToTimeline({
      ts: "503.1",
      user: "U2",
      text: "*rolled back* :face_holding_back_tears: <@U9> see <#C7|inc-db>",
      blocks: [
        {
          type: "rich_text",
          elements: [
            {
              type: "rich_text_section",
              elements: [
                { type: "text", text: "rolled back", style: { bold: true } },
                { type: "text", text: " " },
                {
                  type: "emoji",
                  name: "face_holding_back_tears",
                  unicode: "1f979",
                },
                { type: "text", text: " " },
                { type: "user", user_id: "U9" },
                { type: "text", text: " see " },
                { type: "channel", channel_id: "C7" },
              ],
            },
          ],
        },
      ],
    });
    const rows = await notes();
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toContain(
      "**rolled back** 🥹 @Jane Doe see #inc-db",
    );
    expect(rows[0].message).not.toContain(":face_holding_back_tears:");
  });

  test("the note keeps the time the message was said", async () => {
    const saidAt = Math.floor(Date.now() / 1000) - 3600;
    await addToTimeline({ ts: `${saidAt}.000100`, text: "an hour ago" });
    const rows = await notes();
    expect(rows).toHaveLength(1);
    expect(Math.abs(rows[0].createdAt.getTime() - saidAt * 1000)).toBeLessThan(
      1000,
    );
  });

  test("the note belongs to the author, not whoever ran the shortcut", async () => {
    const author = await createUser();
    await addUserToWorkspace(author.id, 1, "member");
    const authorSlackId = `U_AUTHOR_${crypto.randomUUID()}`;
    slackTestState.usersInfoImpl = (args) =>
      Promise.resolve({
        ok: true,
        user: {
          profile: {
            email:
              args.user === authorSlackId
                ? author.email
                : "ping@openstatus.dev",
          },
        },
      });
    try {
      await addToTimeline({
        ts: "508.1",
        text: "I rolled it back",
        user: authorSlackId,
      });
      const rows = await notes();
      expect(rows).toHaveLength(1);
      expect(rows[0].createdBy).toBe(author.id);
    } finally {
      // The note references the author; drop it before the user.
      await deleteIncidentEvents(incidentId);
      await db
        .delete(slackUser)
        .where(eq(slackUser.slackUserId, authorSlackId));
      await db
        .delete(usersToWorkspaces)
        .where(eq(usersToWorkspaces.userId, author.id));
      await db.delete(user).where(eq(user.id, author.id));
    }
  });

  test("a bot message is attributed to whoever ran the shortcut, without a lookup", async () => {
    // Apps with a bot user carry both `bot_id` and `user`.
    await addToTimeline({
      ts: "509.1",
      text: "[FIRING] api 5xx",
      bot_id: "B1",
      user: "U_BOT",
    });
    const rows = await notes();
    expect(rows).toHaveLength(1);
    const [runner] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, "ping@openstatus.dev"));
    expect(rows[0].createdBy).toBe(runner.id);
    expect(
      slackTestState.calls.some(
        (m) => m.method === "users.info" && m.args.user === "U_BOT",
      ),
    ).toBe(false);
  });

  test("a failed author lookup tells the user and can be retried", async () => {
    const author = await createUser();
    await addUserToWorkspace(author.id, 1, "member");
    const authorSlackId = `U_AUTHOR_${crypto.randomUUID()}`;
    let flaky = true;
    slackTestState.usersInfoImpl = (args) => {
      if (args.user !== authorSlackId) {
        return Promise.resolve({
          ok: true,
          user: { profile: { email: "ping@openstatus.dev" } },
        });
      }
      if (flaky) {
        const err = new Error("An API error occurred: ratelimited");
        Object.assign(err, { data: { ok: false, error: "ratelimited" } });
        return Promise.reject(err);
      }
      return Promise.resolve({
        ok: true,
        user: { profile: { email: author.email } },
      });
    };
    const message = { ts: "510.1", text: "flaky lookup", user: authorSlackId };
    try {
      await addToTimeline(message);
      expect(await notes()).toHaveLength(0);
      expect(reacted()).toBe(false);
      expect(replies.at(-1)?.text).toContain("Please try again");

      flaky = false;
      await addToTimeline(message);
      const rows = await notes();
      expect(rows).toHaveLength(1);
      expect(rows[0].createdBy).toBe(author.id);
    } finally {
      await deleteIncidentEvents(incidentId);
      await db
        .delete(slackUser)
        .where(eq(slackUser.slackUserId, authorSlackId));
      await db
        .delete(usersToWorkspaces)
        .where(eq(usersToWorkspaces.userId, author.id));
      await db.delete(user).where(eq(user.id, author.id));
    }
  });

  test("a message with only attachments is noted from their fallback", async () => {
    await addToTimeline({
      ts: "505.1",
      text: "",
      attachments: [{ fallback: "[FIRING] db latency > 2s" }],
    });
    const rows = await notes();
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toContain("[FIRING] db latency > 2s");
  });

  test("an attachment with an empty fallback is noted from its text", async () => {
    await addToTimeline({
      ts: "507.1",
      text: "",
      attachments: [{ fallback: "", text: "Deploy 1234 failed" }],
    });
    const rows = await notes();
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toContain("Deploy 1234 failed");
  });

  test("a message with nothing to copy tells the user", async () => {
    await addToTimeline({ ts: "506.1", text: "" });
    expect(replies.map((r) => r.text)).toEqual([
      "Nothing to copy from that message.",
    ]);
    expect(reacted()).toBe(false);
    expect(await notes()).toHaveLength(0);
  });

  test("a message already confirmed is not noted twice", async () => {
    slackTestState.reactionsGetImpl = () =>
      Promise.resolve({
        ok: true,
        message: {
          reactions: [{ name: "white_check_mark", users: ["UBOT"] }],
        },
      });
    await addToTimeline({ ts: "501.1", text: "Twice" });
    expect(replies.at(-1)?.text).toContain("already on the timeline");
    expect(reacted()).toBe(false);
    expect(await notes()).toHaveLength(0);
  });

  test("two clicks racing on one message note it once", async () => {
    await Promise.all([
      addToTimeline({ ts: "502.1", text: "Once" }),
      addToTimeline({ ts: "502.1", text: "Once" }, { user: "U3" }),
    ]);
    expect(await notes()).toHaveLength(1);
  });

  test("outside an incident channel it says where it works", async () => {
    await addToTimeline(
      { ts: "511.1", text: "hello" },
      { channel: "C_RANDOM" },
    );
    expect(replies.at(-1)?.text).toContain("isn't an open incident's channel");
    expect(slackTestState.calls).toHaveLength(0);
  });

  test("a closed incident's channel is refused", async () => {
    await db
      .update(incident)
      .set({ closedAt: new Date() })
      .where(eq(incident.id, incidentId));
    await addToTimeline({ ts: "512.1", text: "too late" });
    expect(replies.at(-1)?.text).toContain("isn't an open incident's channel");
    expect(await notes()).toHaveLength(0);
  });

  test("an unlinked user gets the link card", async () => {
    slackTestState.usersInfoImpl = () =>
      Promise.resolve({ ok: true, user: { profile: {} } });
    await addToTimeline(
      { ts: "513.1", text: "who am I" },
      { user: "U_STRANGER" },
    );
    expect(JSON.stringify(replies.at(-1)?.blocks)).toContain("Link account");
    expect(await notes()).toHaveLength(0);
  });

  test("a workspace openstatus isn't connected to is told so", async () => {
    slackTestState.resolveWorkspace = () => Promise.resolve(null);
    await addToTimeline({ ts: "515.1", text: "anyone there" });
    expect(replies.at(-1)?.text).toContain("isn't connected");
    expect(slackTestState.calls).toHaveLength(0);
  });

  test("a workspace without the Slack plan is told to upgrade", async () => {
    slackTestState.resolveWorkspace = () =>
      Promise.resolve({
        botToken: "xoxb-fallback",
        botUserId: "UBOT",
        workspace: { id: 1, limits: { "slack-agent": false } },
      });
    await addToTimeline({ ts: "514.1", text: "upgrade me" });
    expect(replies.at(-1)?.text).toContain("Upgrade");
    expect(await notes()).toHaveLength(0);
  });
});
