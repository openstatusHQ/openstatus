import crypto from "node:crypto";

import { and, db, eq, or, sql } from "@openstatus/db";
import {
  auditLog,
  incident,
  incidentEvent,
  selectWorkspaceSchema,
  type Workspace,
  workspace as workspaceTable,
} from "@openstatus/db/src/schema";
import { declareIncident } from "@openstatus/services/incident";
import { beforeEach, describe, expect, test } from "@openstatus/test-utils";
import { Hono } from "hono";

import { slackTestState } from "@/libs/test/doubles/slack-test-state";
import {
  TEST_SIGNING_SECRET as SIGNING_SECRET,
  withSlackConfig,
} from "@/libs/test/slack-config";

import { handleSlackCommand } from "./commands";
import type { SlackEnv } from "./config";
import { verifySlackSignature } from "./verify";

function createTestApp() {
  const app = withSlackConfig(new Hono<SlackEnv>());
  app.post("/slack/commands", verifySlackSignature, handleSlackCommand);
  return app;
}

function post(
  app: ReturnType<typeof createTestApp>,
  text: string,
  user: string,
  channelId = "C1",
  extra: Record<string, string> = {},
) {
  const body = new URLSearchParams({
    text,
    team_id: "T_KNOWN",
    user_id: user,
    channel_id: channelId,
    ...extra,
  }).toString();
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(`v0:${timestamp}:${body}`)
    .digest("hex");
  return app.request("/slack/commands", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": String(timestamp),
      "x-slack-signature": `v0=${sig}`,
    },
    body,
  });
}

describe("handleSlackCommand (members only)", () => {
  const app = createTestApp();

  beforeEach(() => {
    slackTestState.calls = [];
    slackTestState.resolveWorkspace = (teamId: string) =>
      teamId === "T_KNOWN"
        ? Promise.resolve({
            workspace: { id: 1, limits: { "slack-agent": true } },
            botToken: "xoxb-test",
            botUserId: "UBOT",
          })
        : Promise.resolve(null);
  });

  test("`incident declare` without a title opens the form", async () => {
    slackTestState.usersInfoImpl = () =>
      Promise.resolve({
        ok: true,
        user: { profile: { email: "ping@openstatus.dev" } },
      });
    const res = await post(app, "incident declare", "U_OWNER", "C_HERE", {
      trigger_id: "trig-cmd",
    });
    expect(res.status).toBe(200);
    const open = slackTestState.calls.find((c) => c.method === "views.open");
    expect(open?.args.trigger_id).toBe("trig-cmd");
    const view = open?.args.view as Record<string, unknown>;
    expect(view.callback_id).toBe("declare_incident");
    expect(view.private_metadata).toBe(JSON.stringify({ channelId: "C_HERE" }));
  });

  test("help needs no link", async () => {
    const res = await post(app, "help", `U_${crypto.randomUUID()}`);
    const json = (await res.json()) as { text: string };
    expect(json.text).toContain("/openstatus subscribe");
  });

  test("an unlinked user gets the link card instead of running the command", async () => {
    slackTestState.usersInfoImpl = () =>
      Promise.resolve({ ok: true, user: { profile: {} } });
    const res = await post(app, "subscriptions", `U_${crypto.randomUUID()}`);
    const json = (await res.json()) as {
      text: string;
      blocks?: { type: string }[];
    };
    expect(json.text).toContain("Link your openstatus account");
    expect(json.blocks?.some((b) => b.type === "actions")).toBe(true);
  });

  test("a linked member runs the command", async () => {
    slackTestState.usersInfoImpl = () =>
      Promise.resolve({
        ok: true,
        user: { profile: { email: "ping@openstatus.dev" } },
      });
    const res = await post(app, "subscriptions", `U_${crypto.randomUUID()}`);
    const json = (await res.json()) as { text: string; blocks?: unknown };
    // The `subscriptions` reply itself, not the link card or the error text.
    expect(json.text).toContain("subscribed to");
    expect(json.blocks).toBeUndefined();
  });
});

describe("/openstatus incident", () => {
  const app = createTestApp();
  const redisStore = (globalThis as Record<string, unknown>)
    .__testRedisStore as Map<string, string>;
  let workspace: Workspace;

  beforeEach(async () => {
    slackTestState.calls = [];
    slackTestState.usersInfoImpl = () =>
      Promise.resolve({
        ok: true,
        user: { profile: { email: "ping@openstatus.dev" } },
      });
    workspace = selectWorkspaceSchema.parse(
      await db.query.workspace.findFirst({ where: eq(workspaceTable.id, 1) }),
    );
    slackTestState.resolveWorkspace = (teamId: string) =>
      teamId === "T_KNOWN"
        ? Promise.resolve({
            workspace: {
              ...workspace,
              limits: { ...workspace.limits, "slack-agent": true },
            },
            botToken: "xoxb-test",
            botUserId: "UBOT",
          })
        : Promise.resolve(null);
  });

  test("declare posts an approval card instead of declaring", async () => {
    redisStore.clear();
    const res = await post(
      app,
      "incident declare Checkout down --sev critical",
      `U_${crypto.randomUUID()}`,
    );
    const json = (await res.json()) as { text: string };
    expect(json.text).toContain("approval card");
    const card = slackTestState.calls.find(
      (c) => c.method === "update" && Array.isArray(c.args.blocks),
    );
    expect(card).toBeDefined();
    const pending = [...redisStore.entries()].find(([key]) =>
      key.startsWith("slack:action:"),
    );
    expect(pending?.[1]).toContain("declare_incident");
    expect(pending?.[1]).toContain("critical");
  });

  test("note in a bound channel lands on the timeline", async () => {
    const channelId = `C_INC_${crypto.randomUUID()}`;
    const created = await declareIncident({
      ctx: { workspace, actor: { type: "system", job: "test" } },
      input: { title: "Bound", severity: "minor" },
    });
    await db
      .update(incident)
      .set({ slackTeamId: "T_KNOWN", slackChannelId: channelId })
      .where(eq(incident.id, created.id));
    try {
      const res = await post(
        app,
        "incident note rolled back the deploy",
        `U_${crypto.randomUUID()}`,
        channelId,
      );
      const json = (await res.json()) as { text: string };
      expect(json.text).toContain("Added to the timeline");
      const events = await db
        .select()
        .from(incidentEvent)
        .where(eq(incidentEvent.incidentId, created.id))
        .all();
      expect(events.some((e) => e.message === "rolled back the deploy")).toBe(
        true,
      );
    } finally {
      await db
        .delete(auditLog)
        .where(
          and(
            eq(auditLog.workspaceId, workspace.id),
            or(
              and(
                eq(auditLog.entityType, "incident"),
                eq(auditLog.entityId, String(created.id)),
              ),
              and(
                eq(auditLog.action, "incident_event.create"),
                sql`json_extract(${auditLog.metadata}, '$.incidentId') = ${created.id}`,
              ),
            ),
          ),
        );
      await db
        .delete(incidentEvent)
        .where(eq(incidentEvent.incidentId, created.id));
      await db.delete(incident).where(eq(incident.id, created.id));
    }
  });

  test("note outside an incident channel explains where to run it", async () => {
    const res = await post(
      app,
      "incident note hello",
      `U_${crypto.randomUUID()}`,
    );
    const json = (await res.json()) as { text: string };
    expect(json.text).toContain("incident's channel");
  });
});
