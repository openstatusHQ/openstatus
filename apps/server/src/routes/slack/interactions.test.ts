import crypto from "node:crypto";

import { and, db, eq, inArray } from "@openstatus/db";
import {
  auditLog,
  incident,
  incidentEvent,
  selectWorkspaceSchema,
  slackUser,
  statusReport,
  statusReportUpdate,
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
import {
  bindIncidentSlackChannel,
  declareIncident,
} from "@openstatus/services/incident";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "@openstatus/test-utils";
import { WebClient } from "@slack/web-api";
import { Hono } from "hono";

import { settleBackgroundTasks } from "@/libs/background";
// workspace-resolver / @slack/web-api are swapped for doubles via the test
// import map; behavior is driven through this shared mutable state.
import { reportDraftState } from "@/libs/test/doubles/report-draft-model.mock";
import { slackTestState } from "@/libs/test/doubles/slack-test-state";
import {
  TEST_SIGNING_SECRET as SIGNING_SECRET,
  withSlackConfig,
} from "@/libs/test/slack-config";
import { busyChannelHistory } from "@/libs/test/slack-incident-fixtures";

import type { SlackEnv } from "./config";
import { offersRelink, relinkNoticeBlocks } from "./incident-slack";
import { handleSlackInteraction } from "./interactions";
import { postReportFollowUp } from "./report-follow-up";
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

  test("an approved card is remembered on its thread", async () => {
    seedCreateMaintenance();
    await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "2.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_maint-001" }],
    });
    const remembered = JSON.parse(redisStore.get("slack:created:2.1") ?? "[]");
    expect(remembered).toEqual([
      { kind: "maintenance", id: expect.any(Number), label: "DB Maintenance" },
    ]);
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

  for (const { toolName, input, type } of [
    { toolName: "resolve_incident", input: {}, type: "resolved" },
    {
      toolName: "update_incident",
      input: { severity: "critical" },
      type: "severity_changed",
    },
  ] as const) {
    test(`an approved ${toolName} links its event to the card`, async () => {
      const created = await declareIncident({
        ctx: {
          workspace: selectWorkspaceSchema.parse(
            await db
              .select()
              .from(workspaceTable)
              .where(eq(workspaceTable.id, 1))
              .get(),
          ),
          actor: { type: "system", job: "test" },
        },
        input: { title: "Card origin", severity: "minor" },
      });
      const id = `inc-${crypto.randomUUID()}`;
      redisStore.set(
        `slack:action:${id}`,
        JSON.stringify({
          ...basePending,
          id,
          threadTs: "4.1",
          messageTs: "4.2",
          payload: { toolName, input: { id: created.id, ...input } },
        }),
      );
      try {
        const res = await signAndPost(app, {
          type: "block_actions",
          user: { id: "U_OWNER" },
          channel: { id: "C1" },
          message: { ts: "4.2" },
          team: { id: "T_KNOWN" },
          actions: [{ action_id: `approve_${id}` }],
        });
        expect(res.status).toBe(200);
        const event = await db
          .select()
          .from(incidentEvent)
          .where(
            and(
              eq(incidentEvent.incidentId, created.id),
              eq(incidentEvent.type, type),
            ),
          )
          .get();
        expect(event?.source).toBe("slack");
        expect(event?.sourceRef).toBe("https://slack.test/archives/C1/p42");
      } finally {
        await deleteIncidentEvents(created.id);
        await db
          .delete(auditLog)
          .where(
            and(
              eq(auditLog.entityType, "incident"),
              eq(auditLog.entityId, String(created.id)),
            ),
          );
        await db.delete(incident).where(eq(incident.id, created.id));
      }
    });
  }

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
      const declared = await db
        .select()
        .from(incidentEvent)
        .where(
          and(
            eq(incidentEvent.incidentId, row?.id ?? -1),
            eq(incidentEvent.type, "declared"),
          ),
        )
        .get();
      expect(declared?.source).toBe("slack");
      expect(declared?.sourceRef).toBeNull();
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
    expect(rows[0].message).toBe("Rolled back to v41");
    expect(rows[0].source).toBe("slack");
    expect(rows[0].sourceRef).toBe(
      `https://slack.test/archives/${channelId}/p5001`,
    );
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

describe("pinned incident card buttons", () => {
  const app = createTestApp();
  let workspace: ReturnType<typeof selectWorkspaceSchema.parse>;
  let incidentId: number;

  beforeEach(async () => {
    configureSlackDoubles();
    redisStore.clear();
    workspace = selectWorkspaceSchema.parse(
      await db.query.workspace.findFirst({ where: eq(workspaceTable.id, 1) }),
    );
    const created = await declareIncident({
      ctx: { workspace, actor: { type: "system", job: "test" } },
      input: { title: `Card ${crypto.randomUUID()}`, severity: "major" },
    });
    incidentId = created.id;
  });

  afterEach(async () => {
    const row = await db
      .select({ statusReportId: incident.statusReportId })
      .from(incident)
      .where(eq(incident.id, incidentId))
      .get();
    await deleteIncidentEvents(incidentId);
    await db
      .delete(auditLog)
      .where(
        and(
          eq(auditLog.entityType, "incident"),
          eq(auditLog.entityId, String(incidentId)),
        ),
      );
    await db.delete(incident).where(eq(incident.id, incidentId));
    if (row?.statusReportId) {
      await db
        .delete(statusReportUpdate)
        .where(eq(statusReportUpdate.statusReportId, row.statusReportId));
      await db
        .delete(statusReport)
        .where(eq(statusReport.id, row.statusReportId));
    }
  });

  function click(actionId: string) {
    return signAndPost(app, {
      type: "block_actions",
      trigger_id: "trig-card",
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
      channel: { id: "C_INC" },
      message: { ts: "77.7" },
      actions: [{ action_id: actionId, value: String(incidentId) }],
    });
  }

  function submit(
    callbackId: string,
    values: Record<string, unknown>,
    extraMeta: Record<string, unknown> = {},
  ) {
    return signAndPost(app, {
      type: "view_submission",
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
      view: {
        callback_id: callbackId,
        private_metadata: JSON.stringify({
          incidentId,
          channelId: "C_INC",
          messageTs: "77.7",
          ...extraMeta,
        }),
        state: { values },
      },
    });
  }

  function openedView() {
    const open = slackTestState.calls.find((c) => c.method === "views.open");
    return open?.args.view as {
      callback_id?: string;
      private_metadata?: string;
      blocks: unknown[];
    };
  }

  test("Update status opens a form offering only allowed transitions", async () => {
    await click("incident_card_update_status");
    const view = openedView();
    expect(view.callback_id).toBe("incident_card_update_status");
    expect(JSON.parse(view.private_metadata ?? "{}")).toEqual({
      incidentId,
      channelId: "C_INC",
      messageTs: "77.7",
    });
    const blocks = JSON.stringify(view.blocks);
    for (const status of ["open", "mitigated", "resolved", "canceled"]) {
      expect(blocks).toContain(`"value":"${status}"`);
    }
  });

  test("submitting a new status moves the incident and redraws the card", async () => {
    const res = await submit("incident_card_update_status", {
      status: { value: { selected_option: { value: "mitigated" } } },
      severity: { value: { selected_option: { value: "critical" } } },
      note: { value: { value: "Rolled back" } },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
    const row = await db
      .select()
      .from(incident)
      .where(eq(incident.id, incidentId))
      .get();
    expect(row?.status).toBe("mitigated");
    expect(row?.severity).toBe("critical");
    const card = slackTestState.calls.find(
      (c) => c.method === "update" && c.args.ts === "77.7",
    );
    expect(card?.args.channel).toBe("C_INC");
    expect(JSON.stringify(card?.args.blocks)).toContain("*Status:* mitigated");
  });

  test("submitting without any change is rejected on the form", async () => {
    const res = await submit("incident_card_update_status", {
      status: { value: { selected_option: { value: "open" } } },
      severity: { value: { selected_option: { value: "major" } } },
    });
    expect(await res.json()).toEqual({
      response_action: "errors",
      errors: { note: "Change the status or severity, or write an update." },
    });
  });

  test("Update status page offers to create a report when none is linked", async () => {
    await click("incident_card_status_page");
    const view = openedView();
    expect(view.callback_id).toBe("incident_card_status_page");
    expect(JSON.stringify(view.blocks)).toContain('"block_id":"page"');
  });

  test("publishing creates a status report linked to the incident", async () => {
    const res = await submit("incident_card_status_page", {
      page: { incident_card_page: { selected_option: { value: "1" } } },
      title: { value: { value: "Elevated errors" } },
      status: { value: { selected_option: { value: "investigating" } } },
      message: { value: { value: "We are looking into it." } },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
    const row = await db
      .select()
      .from(incident)
      .where(eq(incident.id, incidentId))
      .get();
    expect(row?.statusReportId).not.toBeNull();
    const report = await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.id, row?.statusReportId ?? -1))
      .get();
    expect(report?.title).toBe("Elevated errors");
    expect(report?.pageId).toBe(1);
  });

  test("with a linked report, the button adds an update to it", async () => {
    await submit("incident_card_status_page", {
      page: { incident_card_page: { selected_option: { value: "1" } } },
      title: { value: { value: "Elevated errors" } },
      status: { value: { selected_option: { value: "investigating" } } },
      message: { value: { value: "We are looking into it." } },
    });
    slackTestState.calls = [];
    await click("incident_card_status_page");
    const view = openedView();
    const meta = JSON.parse(view.private_metadata ?? "{}");
    expect(meta.statusReportId).toBeGreaterThan(0);
    expect(JSON.stringify(view.blocks)).not.toContain('"block_id":"page"');

    const res = await submit(
      "incident_card_status_page",
      {
        status: { value: { selected_option: { value: "identified" } } },
        message: { value: { value: "Found the bad deploy." } },
      },
      { statusReportId: meta.statusReportId },
    );
    expect(await res.text()).toBe("");
    const report = await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.id, meta.statusReportId))
      .get();
    expect(report?.status).toBe("identified");
    const updates = await db
      .select()
      .from(statusReportUpdate)
      .where(eq(statusReportUpdate.statusReportId, meta.statusReportId))
      .all();
    expect(updates.map((u) => u.message)).toContain("Found the bad deploy.");
  });

  test("picking another status page redraws the form for that page", async () => {
    const res = await signAndPost(app, {
      type: "block_actions",
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
      view: {
        id: "V_FORM",
        hash: "h1",
        private_metadata: JSON.stringify({ incidentId }),
      },
      actions: [
        { action_id: "incident_card_page", selected_option: { value: "1" } },
      ],
    });
    expect(res.status).toBe(200);
    const update = slackTestState.calls.find(
      (c) => c.method === "views.update",
    );
    expect(update?.args.view_id).toBe("V_FORM");
    expect(update?.args.hash).toBe("h1");
    const view = update?.args.view as {
      callback_id?: string;
      blocks: unknown[];
    };
    expect(view.callback_id).toBe("incident_card_status_page");
    expect(JSON.stringify(view.blocks)).toContain(
      '"initial_option":{"text":{"type":"plain_text","text":',
    );
  });

  function startedAtOf(blocks: unknown[]) {
    const block = blocks.find(
      (b): b is { block_id: string; element: { initial_date_time: number } } =>
        typeof b === "object" &&
        b !== null &&
        "block_id" in b &&
        b.block_id === "started_at",
    );
    return block?.element.initial_date_time;
  }

  async function incidentRow() {
    return db.select().from(incident).where(eq(incident.id, incidentId)).get();
  }

  const reportValues = (startedAt: number) => ({
    page: { incident_card_page: { selected_option: { value: "1" } } },
    title: { value: { value: "Elevated errors" } },
    status: { value: { selected_option: { value: "investigating" } } },
    started_at: { value: { selected_date_time: startedAt } },
    message: { value: { value: "We are looking into it." } },
  });

  test("Started at defaults to when the incident started", async () => {
    const row = await incidentRow();
    await click("incident_card_status_page");
    expect(startedAtOf(openedView().blocks)).toBe(
      Math.floor((row?.startedAt.getTime() ?? 0) / 1000),
    );
  });

  test("an earlier Started at dates the report and moves the incident back", async () => {
    const earlier = Math.floor(Date.now() / 1000) - 11 * 3600;
    expect(
      await (
        await submit("incident_card_status_page", reportValues(earlier))
      ).text(),
    ).toBe("");
    const row = await incidentRow();
    expect(row?.startedAt.getTime()).toBe(earlier * 1000);
    const updates = await db
      .select()
      .from(statusReportUpdate)
      .where(eq(statusReportUpdate.statusReportId, row?.statusReportId ?? -1))
      .all();
    expect(updates[0]?.date.getTime()).toBe(earlier * 1000);
  });

  test("a later Started at leaves the incident's start alone", async () => {
    await db
      .update(incident)
      .set({ startedAt: new Date(Date.now() - 2 * 3600 * 1000) })
      .where(eq(incident.id, incidentId));
    const before = await incidentRow();
    const later = Math.floor(Date.now() / 1000) - 60;
    await submit("incident_card_status_page", reportValues(later));
    const row = await incidentRow();
    expect(row?.startedAt.getTime()).toBe(before?.startedAt.getTime());
    expect(row?.statusReportId).not.toBeNull();
  });

  test("a Started at in the future is refused on the form", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const res = await submit("incident_card_status_page", reportValues(future));
    expect(JSON.parse(await res.text())).toEqual({
      response_action: "errors",
      errors: { started_at: "Pick a time that isn't in the future." },
    });
    expect((await incidentRow())?.statusReportId).toBeNull();
  });

  test("a page switch keeps the chosen Started at", async () => {
    await signAndPost(app, {
      type: "block_actions",
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
      view: {
        id: "V_FORM",
        hash: "h1",
        private_metadata: JSON.stringify({ incidentId }),
        state: {
          values: { started_at: { value: { selected_date_time: 1792098600 } } },
        },
      },
      actions: [
        { action_id: "incident_card_page", selected_option: { value: "1" } },
      ],
    });
    const update = slackTestState.calls.find(
      (c) => c.method === "views.update",
    );
    const view = update?.args.view as { blocks: unknown[] } | undefined;
    expect(startedAtOf(view?.blocks ?? [])).toBe(1792098600);
  });

  test("a refused status change leaves the severity untouched", async () => {
    await db
      .update(incident)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(incident.id, incidentId));
    const res = await submit("incident_card_update_status", {
      status: { value: { selected_option: { value: "mitigated" } } },
      severity: { value: { selected_option: { value: "critical" } } },
    });
    const body = await res.json();
    expect(body.response_action).toBe("errors");
    expect(body.errors.status).toBeDefined();
    const row = await db
      .select()
      .from(incident)
      .where(eq(incident.id, incidentId))
      .get();
    expect(row?.severity).toBe("major");
  });
});

describe("publish status update button", () => {
  const app = createTestApp();
  const created: number[] = [];

  beforeEach(() => {
    configureSlackDoubles();
    redisStore.clear();
  });

  afterEach(async () => {
    for (const id of created.splice(0)) {
      await db
        .delete(statusReportUpdate)
        .where(eq(statusReportUpdate.statusReportId, id));
      await db.delete(statusReport).where(eq(statusReport.id, id));
    }
  });

  test("opens the form with no incident attached", async () => {
    await signAndPost(app, {
      type: "block_actions",
      trigger_id: "trig-welcome",
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
      channel: { id: "C_NEW" },
      actions: [{ action_id: "open_publish_status_update" }],
    });
    const open = slackTestState.calls.find((c) => c.method === "views.open");
    expect(open?.args.trigger_id).toBe("trig-welcome");
    const view = open?.args.view as {
      callback_id?: string;
      private_metadata?: string;
      blocks: unknown[];
    };
    expect(view.callback_id).toBe("incident_card_status_page");
    expect(JSON.parse(view.private_metadata ?? "{}")).toEqual({
      channelId: "C_NEW",
    });
    expect(JSON.stringify(view.blocks)).not.toContain(
      "linked to this incident",
    );
  });

  test("picking another status page redraws the form without an incident", async () => {
    await signAndPost(app, {
      type: "block_actions",
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
      view: {
        id: "V_WELCOME",
        private_metadata: JSON.stringify({ channelId: "C_NEW" }),
      },
      actions: [
        { action_id: "incident_card_page", selected_option: { value: "1" } },
      ],
    });
    const update = slackTestState.calls.find(
      (c) => c.method === "views.update",
    );
    expect(update?.args.view_id).toBe("V_WELCOME");
    const view = update?.args.view as {
      callback_id?: string;
      private_metadata?: string;
      blocks: unknown[];
    };
    expect(view.callback_id).toBe("incident_card_status_page");
    expect(JSON.parse(view.private_metadata ?? "{}")).toEqual({
      channelId: "C_NEW",
    });
    expect(JSON.stringify(view.blocks)).not.toContain(
      "linked to this incident",
    );
  });

  test("publishing creates an unlinked report and posts it in the channel", async () => {
    const title = `Welcome ${crypto.randomUUID()}`;
    const res = await signAndPost(app, {
      type: "view_submission",
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
      view: {
        callback_id: "incident_card_status_page",
        private_metadata: JSON.stringify({ channelId: "C_NEW" }),
        state: {
          values: {
            page: { incident_card_page: { selected_option: { value: "1" } } },
            title: { value: { value: title } },
            status: { value: { selected_option: { value: "investigating" } } },
            message: { value: { value: "We are looking into it." } },
          },
        },
      },
    });
    expect(await res.text()).toBe("");
    const report = await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.title, title))
      .get();
    if (report) created.push(report.id);
    expect(report?.pageId).toBe(1);
    const linked = await db
      .select()
      .from(incident)
      .where(eq(incident.statusReportId, report?.id ?? -1))
      .get();
    expect(linked).toBeUndefined();
    const post = slackTestState.calls.find(
      (c) => c.method === "postMessage" && c.args.channel === "C_NEW",
    );
    expect(String(post?.args.text)).toContain("published a status page update");
  });
});

describe("status report follow-up after a declare", () => {
  const app = createTestApp();
  let workspace: ReturnType<typeof selectWorkspaceSchema.parse>;
  let incidentId: number;
  const startedAt = Math.floor(Date.now() / 1000) - 11 * 3600;

  beforeEach(async () => {
    configureSlackDoubles();
    redisStore.clear();
    reportDraftState.calls = [];
    reportDraftState.impl = () =>
      Promise.resolve({
        pageId: 1,
        componentIds: [2],
        impact: "major_outage",
        message: "The dashboard API is returning errors. We are investigating.",
        startedAt: new Date(startedAt * 1000).toISOString(),
        startedAtSource: "first error in #prod-emergency",
      });
    slackTestState.historyImpl = () =>
      Promise.resolve({ messages: busyChannelHistory });
    workspace = selectWorkspaceSchema.parse(
      await db.query.workspace.findFirst({ where: eq(workspaceTable.id, 1) }),
    );
    const created = await declareIncident({
      ctx: { workspace, actor: { type: "system", job: "test" } },
      input: { title: `Follow-up ${crypto.randomUUID()}`, severity: "major" },
    });
    incidentId = created.id;
  });

  afterEach(async () => {
    const row = await db
      .select({ statusReportId: incident.statusReportId })
      .from(incident)
      .where(eq(incident.id, incidentId))
      .get();
    await deleteIncidentEvents(incidentId);
    await db
      .delete(auditLog)
      .where(
        and(
          eq(auditLog.entityType, "incident"),
          eq(auditLog.entityId, String(incidentId)),
        ),
      );
    await db.delete(incident).where(eq(incident.id, incidentId));
    if (row?.statusReportId) {
      await db
        .delete(statusReportUpdate)
        .where(eq(statusReportUpdate.statusReportId, row.statusReportId));
      await db
        .delete(statusReport)
        .where(eq(statusReport.id, row.statusReportId));
    }
  });

  function post() {
    return postReportFollowUp({
      ctx: { workspace, actor: { type: "system", job: "test" } },
      slack: new WebClient("xoxb-test"),
      incidentId,
      channelId: "C_INCIDENT",
      sourceChannelId: "C_ORIGIN",
    });
  }

  function followUp() {
    return slackTestState.calls.find(
      (c) => c.method === "postMessage" && c.args.channel === "C_INCIDENT",
    );
  }

  function buttonValue(actionId: string) {
    const blocks = followUp()?.args.blocks as {
      type: string;
      elements?: { action_id?: string; value?: string }[];
    }[];
    return blocks
      .flatMap((b) => b.elements ?? [])
      .find((e) => e.action_id === actionId)?.value;
  }

  function click(actionId: string) {
    return signAndPost(app, {
      type: "block_actions",
      trigger_id: "trig-follow-up",
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
      channel: { id: "C_INCIDENT" },
      message: { ts: "88.8" },
      actions: [{ action_id: actionId, value: buttonValue(actionId) }],
    });
  }

  test("posts the drafted report in the incident channel", async () => {
    await post();
    const history = slackTestState.calls.find(
      (c) => c.method === "conversations.history",
    );
    expect(history?.args.channel).toBe("C_ORIGIN");
    expect(reportDraftState.calls[0]?.prompt).toContain("Seeing 500s");
    const text = JSON.stringify(followUp()?.args.blocks);
    expect(text).toContain("Customers haven't been told yet");
    expect(text).toContain("The dashboard API is returning errors.");
    expect(text).toContain("Google Monitor");
    expect(text).toContain(`<!date^${startedAt}^`);
    expect(text).toContain("first error in #prod-emergency");
  });

  test("a closed incident gets no follow-up", async () => {
    await db
      .update(incident)
      .set({ closedAt: new Date() })
      .where(eq(incident.id, incidentId));
    await post();
    expect(followUp()).toBeUndefined();
  });

  test("a failed draft still offers the form, without a quote", async () => {
    reportDraftState.impl = () => Promise.reject(new Error("timeout"));
    await post();
    const text = JSON.stringify(followUp()?.args.blocks);
    expect(text).toContain("Create status report");
    expect(text).not.toContain("Suggested update");
  });

  test("Create status report opens the form filled from the draft", async () => {
    await post();
    await click("incident_report_follow_up_create");
    const open = slackTestState.calls.find((c) => c.method === "views.open");
    const view = open?.args.view as {
      private_metadata: string;
      blocks: {
        block_id?: string;
        element?: {
          initial_value?: string;
          initial_options?: { value: string }[];
          initial_option?: { value: string };
          initial_date_time?: number;
        };
      }[];
    };
    const block = (id: string) =>
      view.blocks.find((b) => b.block_id === id)?.element;
    expect(JSON.parse(view.private_metadata)).toMatchObject({
      incidentId,
      channelId: "C_INCIDENT",
      followUpTs: "88.8",
    });
    expect(block("message")?.initial_value).toBe(
      "The dashboard API is returning errors. We are investigating.",
    );
    expect(block("components_1")?.initial_options).toEqual([
      expect.objectContaining({ value: "2" }),
    ]);
    expect(block("impact")?.initial_option?.value).toBe("major_outage");
    expect(block("started_at")?.initial_date_time).toBe(startedAt);
  });

  test("publishing from the follow-up links the report and settles the card", async () => {
    const res = await signAndPost(app, {
      type: "view_submission",
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
      view: {
        callback_id: "incident_card_status_page",
        private_metadata: JSON.stringify({
          incidentId,
          channelId: "C_INCIDENT",
          followUpTs: "88.8",
        }),
        state: {
          values: {
            page: { incident_card_page: { selected_option: { value: "1" } } },
            title: { value: { value: "Dashboard errors" } },
            status: { value: { selected_option: { value: "investigating" } } },
            started_at: { value: { selected_date_time: startedAt } },
            message: { value: { value: "We are investigating." } },
          },
        },
      },
    });
    expect(await res.text()).toBe("");
    const row = await db
      .select()
      .from(incident)
      .where(eq(incident.id, incidentId))
      .get();
    expect(row?.statusReportId).not.toBeNull();
    expect(row?.startedAt.getTime()).toBe(startedAt * 1000);
    const settled = slackTestState.calls.find(
      (c) => c.method === "update" && c.args.ts === "88.8",
    );
    expect(settled?.args.text).toContain("Status report created by <@U_OWNER>");
    expect(settled?.args.blocks).toEqual([]);
  });

  test("Not needed removes the buttons", async () => {
    await post();
    await click("incident_report_follow_up_skip");
    const settled = slackTestState.calls.find(
      (c) => c.method === "update" && c.args.ts === "88.8",
    );
    expect(settled?.args).toMatchObject({
      channel: "C_INCIDENT",
      text: "Status report skipped by <@U_OWNER>.",
      blocks: [],
    });
  });
});

describe("next steps after an approval", () => {
  const app = createTestApp();
  let reportId: number | undefined;

  beforeEach(() => {
    configureSlackDoubles();
    redisStore.clear();
    reportId = undefined;
  });

  afterEach(async () => {
    if (reportId === undefined) return;
    await db
      .delete(statusReportUpdate)
      .where(eq(statusReportUpdate.statusReportId, reportId));
    await db.delete(statusReport).where(eq(statusReport.id, reportId));
  });

  async function approveReport() {
    seedCreateStatusReport();
    await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_pending-123" }],
    });
    const update = slackTestState.calls.find(
      (c) => c.method === "update" && c.args.ts === "1.2",
    );
    const blocks = update?.args.blocks as {
      type: string;
      elements?: { action_id?: string; value?: string; text?: string }[];
    }[];
    const elements = blocks.flatMap((b) => b.elements ?? []);
    reportId = Number(elements.find((e) => e.action_id)?.value);
    return { update, elements };
  }

  function clickNext(actionId: string) {
    return signAndPost(app, {
      type: "block_actions",
      trigger_id: "trig-next",
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "1.2" },
      actions: [{ action_id: actionId, value: String(reportId) }],
    });
  }

  function openedStatus() {
    const open = slackTestState.calls.find((c) => c.method === "views.open");
    const view = open?.args.view as {
      callback_id: string;
      private_metadata: string;
      blocks: {
        block_id?: string;
        element?: { initial_option?: { value: string } };
      }[];
    };
    return {
      view,
      status: view.blocks.find((b) => b.block_id === "status")?.element
        ?.initial_option?.value,
    };
  }

  test("an approved report gets the next step and its buttons", async () => {
    const { update, elements } = await approveReport();
    expect(JSON.stringify(update?.args.blocks)).toContain(
      "Next: post an update when you know more.",
    );
    expect(elements.map((e) => e.action_id).filter(Boolean)).toEqual([
      "report_next_post_update",
      "report_next_resolve",
    ]);
    expect(reportId).toBeGreaterThan(0);
  });

  test("Post update opens the update form for that report", async () => {
    await approveReport();
    slackTestState.calls = [];
    await clickNext("report_next_post_update");
    const { view, status } = openedStatus();
    expect(view.callback_id).toBe("incident_card_status_page");
    expect(JSON.parse(view.private_metadata)).toMatchObject({
      statusReportId: reportId,
      channelId: "C1",
    });
    expect(status).toBe("investigating");
  });

  test("Resolve opens the same form preset to resolved", async () => {
    await approveReport();
    slackTestState.calls = [];
    await clickNext("report_next_resolve");
    expect(openedStatus().status).toBe("resolved");
  });

  test("a maintenance gets no next step", async () => {
    seedCreateMaintenance();
    await signAndPost(app, {
      type: "block_actions",
      user: { id: "U_OWNER" },
      channel: { id: "C1" },
      message: { ts: "2.2" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "approve_maint-001" }],
    });
    const update = slackTestState.calls.find(
      (c) => c.method === "update" && c.args.ts === "2.2",
    );
    expect(update?.args.blocks).toEqual([]);
  });
});

describe("link this channel instead", () => {
  const app = createTestApp();
  let workspace: ReturnType<typeof selectWorkspaceSchema.parse>;
  let ids: number[];
  let oldChannel: string;
  let sourceChannel: string;

  beforeEach(async () => {
    configureSlackDoubles();
    redisStore.clear();
    slackTestState.archiveImpl = () => Promise.resolve({ ok: true });
    workspace = selectWorkspaceSchema.parse(
      await db.query.workspace.findFirst({ where: eq(workspaceTable.id, 1) }),
    );
    const suffix = crypto.randomUUID().replaceAll("-", "").toUpperCase();
    oldChannel = `CINC${suffix}`;
    sourceChannel = `CSRC${suffix}`;
    ids = [await declareBound(oldChannel)];
  });

  afterEach(async () => {
    for (const id of ids) {
      await deleteIncidentEvents(id);
      await db
        .delete(auditLog)
        .where(
          and(
            eq(auditLog.entityType, "incident"),
            eq(auditLog.entityId, String(id)),
          ),
        );
      await db.delete(incident).where(eq(incident.id, id));
    }
  });

  async function declareBound(channelId: string) {
    const ctx = { workspace, actor: { type: "system" as const, job: "test" } };
    const created = await declareIncident({
      ctx,
      input: { title: `Relink ${crypto.randomUUID()}`, severity: "major" },
    });
    await bindIncidentSlackChannel({
      ctx,
      input: { id: created.id, teamId: "T_KNOWN", channelId },
    });
    return created.id;
  }

  function relink(userId = "U_OWNER") {
    const value = (
      relinkNoticeBlocks(ids[0], oldChannel)[1] as {
        elements: { value: string }[];
      }
    ).elements[0].value;
    return signAndPost(app, {
      type: "block_actions",
      user: { id: userId },
      channel: { id: sourceChannel },
      message: { ts: "5.5" },
      team: { id: "T_KNOWN" },
      actions: [{ action_id: "incident_relink", value }],
    });
  }

  async function boundChannel() {
    const row = await db
      .select({ slackChannelId: incident.slackChannelId })
      .from(incident)
      .where(eq(incident.id, ids[0]))
      .get();
    return row?.slackChannelId;
  }

  test("is only offered from a channel other than the incident's", () => {
    expect(offersRelink("C1", "C2")).toBe(true);
    expect(offersRelink("G1", "C2")).toBe(true);
    expect(offersRelink("D1", "C2")).toBe(false);
    expect(offersRelink("C2", "C2")).toBe(false);
  });

  test("moves the incident, pins its card and archives the old channel", async () => {
    await relink();
    expect(await boundChannel()).toBe(sourceChannel);
    const posted = slackTestState.calls.filter(
      (c) => c.method === "postMessage",
    );
    expect(
      posted.find((c) => c.args.channel === sourceChannel)?.args.text,
    ).toContain("Incident: Relink");
    expect(
      slackTestState.calls.find((c) => c.method === "pins.add")?.args.channel,
    ).toBe(sourceChannel);
    expect(
      posted.find((c) => c.args.channel === oldChannel)?.args.text,
    ).toContain(`moved this incident to <#${sourceChannel}>`);
    expect(
      slackTestState.calls.find((c) => c.method === "conversations.archive")
        ?.args.channel,
    ).toBe(oldChannel);
    const notice = slackTestState.calls.find(
      (c) => c.method === "update" && c.args.ts === "5.5",
    );
    expect(notice?.args.text).toContain("now the incident channel");
  });

  test("a channel already linked to another incident is refused", async () => {
    ids.push(await declareBound(sourceChannel));
    await relink();
    expect(await boundChannel()).toBe(oldChannel);
    const ephemeral = slackTestState.calls.find(
      (c) => c.method === "postEphemeral",
    );
    expect(String(ephemeral?.args.text)).toContain(":x:");
    expect(
      slackTestState.calls.some((c) => c.method === "conversations.archive"),
    ).toBe(false);
  });

  test("a failed archive keeps the move", async () => {
    slackTestState.archiveImpl = () =>
      Promise.reject(new Error("An API error occurred: restricted_action"));
    await relink();
    expect(await boundChannel()).toBe(sourceChannel);
    expect(
      slackTestState.calls.some(
        (c) => c.method === "update" && c.args.ts === "5.5",
      ),
    ).toBe(true);
  });

  test("someone without a linked account is refused", async () => {
    slackTestState.usersInfoImpl = () =>
      Promise.resolve({ ok: true, user: { profile: {} } });
    await relink(`U_STRANGER_${crypto.randomUUID()}`);
    expect(await boundChannel()).toBe(oldChannel);
    const ephemeral = slackTestState.calls.find(
      (c) => c.method === "postEphemeral",
    );
    expect(String(ephemeral?.args.text)).toContain(
      "Link your openstatus account",
    );
  });
});

describe("welcome card buttons", () => {
  const app = createTestApp();
  const realFetch = globalThis.fetch;
  let posted: { url: string; body: string }[];

  beforeEach(() => {
    configureSlackDoubles();
    redisStore.clear();
    posted = [];
    globalThis.fetch = (input, init) => {
      posted.push({ url: String(input), body: String(init?.body ?? "") });
      return Promise.resolve(new Response("ok"));
    };
    slackTestState.historyImpl = () =>
      Promise.resolve({ messages: busyChannelHistory });
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    slackTestState.runAgentOverride = null;
  });

  function clickWelcome(actionId: string) {
    return signAndPost(app, {
      type: "block_actions",
      trigger_id: "trig-welcome",
      response_url: "https://hooks.slack.test/welcome",
      container: { type: "message", is_ephemeral: true },
      team: { id: "T_KNOWN" },
      user: { id: "U_OWNER" },
      channel: { id: "C_WELCOME" },
      actions: [{ action_id: actionId }],
    });
  }

  test("a click removes the welcome so it isn't clicked twice", async () => {
    await clickWelcome("open_publish_status_update");
    expect(posted).toEqual([
      {
        url: "https://hooks.slack.test/welcome",
        body: JSON.stringify({ delete_original: true }),
      },
    ]);
  });

  test("Catch up posts in the channel and runs the agent on its history", async () => {
    const seen: { contextNote?: string }[] = [];
    slackTestState.runAgentOverride = (options) => {
      seen.push(options as { contextNote?: string });
      return Promise.resolve({
        text: "Summary: the dashboard API has been failing since 21:10 UTC.",
        toolResults: [],
        finishReason: "stop",
        stepCount: 1,
        hitStepLimit: false,
        aborted: false,
      });
    };
    await clickWelcome("welcome_catch_up");
    const root = slackTestState.calls.find(
      (c) =>
        c.method === "postMessage" &&
        String(c.args.text).startsWith(":eyes: Catching up"),
    );
    expect(root?.args).toMatchObject({
      channel: "C_WELCOME",
      text: ":eyes: Catching up on <#C_WELCOME> for <@U_OWNER>.",
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].contextNote).toContain("Seeing 500s on the dashboard API");
    const history = slackTestState.calls.find(
      (c) => c.method === "conversations.history",
    );
    expect(history?.args).toMatchObject({ channel: "C_WELCOME", limit: 50 });
  });

  test("a quiet channel gets a summary and no card", async () => {
    slackTestState.historyImpl = () => Promise.resolve({ messages: [] });
    slackTestState.runAgentOverride = () =>
      Promise.resolve({
        text: "Nothing is going on here.",
        toolResults: [],
        finishReason: "stop",
        stepCount: 1,
        hitStepLimit: false,
        aborted: false,
      });
    await clickWelcome("welcome_catch_up");
    expect(JSON.stringify(slackTestState.calls).includes("approve_")).toBe(
      false,
    );
  });
});
