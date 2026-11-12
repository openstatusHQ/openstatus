import crypto from "node:crypto";

import { and, db, eq } from "@openstatus/db";
import {
  auditLog,
  incident,
  incidentEvent,
  integration,
  selectWorkspaceSchema,
  workspace as workspaceTable,
} from "@openstatus/db/src/schema";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import {
  declareIncident,
  INCIDENT_SLA_NOTICE_ACKNOWLEDGE,
  incidentSlaNoticeBlocks,
} from "@openstatus/services/incident";
import { SLACK_BOT_SCOPES } from "@openstatus/services/integration";
import { Hono } from "hono";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { settleBackgroundTasks } from "@/libs/background";
import { slackTestState } from "@/libs/test/doubles/slack-test-state";
import {
  TEST_SIGNING_SECRET as SIGNING_SECRET,
  withSlackConfig,
} from "@/libs/test/slack-config";

import type { SlackEnv } from "./config";
import { handleSlackInteraction } from "./interactions";
import { verifySlackSignature } from "./verify";

const redisStore = (globalThis as Record<string, unknown>)
  .__testRedisStore as Map<string, string>;

function createTestApp() {
  const app = withSlackConfig(new Hono<SlackEnv>());
  app.post("/slack/interactions", verifySlackSignature, handleSlackInteraction);
  return app;
}

async function signAndPost(
  app: ReturnType<typeof createTestApp>,
  payload: Record<string, unknown>,
) {
  const body = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(`v0:${timestamp}:${body}`)
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

describe("Acknowledge on a response notice", () => {
  const app = createTestApp();
  let incidentId: number;
  let installId: number;
  const dueAt = new Date("2026-11-11T20:50:00Z");
  let workspaceId: number;
  let ownerEmail: string;
  let teamId: string;

  beforeAll(async () => {
    const fixture = await createTestWorkspace();
    workspaceId = fixture.workspace.id;
    ownerEmail = fixture.user.email ?? "";
    teamId = `T_NOTICE_${workspaceId}`;
  });

  beforeEach(async () => {
    slackTestState.calls = [];
    slackTestState.usersInfoImpl = () =>
      Promise.resolve({
        ok: true,
        user: { profile: { email: ownerEmail } },
      });
    slackTestState.resolveWorkspace = (id: string) =>
      id === teamId
        ? Promise.resolve({
            botToken: "xoxb-fallback",
            workspace: { id: workspaceId, limits: { "slack-agent": true } },
          })
        : Promise.resolve(null);
    redisStore.clear();
    const workspace = selectWorkspaceSchema.parse(
      await db.query.workspace.findFirst({
        where: eq(workspaceTable.id, workspaceId),
      }),
    );
    const created = await declareIncident({
      ctx: { workspace, actor: { type: "system", job: "test" } },
      input: { title: `Notice ${crypto.randomUUID()}`, severity: "critical" },
    });
    incidentId = created.id;
    await db
      .update(incident)
      .set({
        slaSnapshot: {
          targets: { critical: { responseMinutes: 60 } },
          resolutionStop: "mitigated",
        },
        slackTeamId: teamId,
        slackChannelId: "C_NOTICE",
      })
      .where(eq(incident.id, incidentId));
    const install = await db
      .insert(integration)
      .values({
        name: "slack-agent",
        workspaceId,
        externalId: teamId,
        credential: { botToken: "xoxb-test", botUserId: "UBOT" },
        data: { teamId, scopes: SLACK_BOT_SCOPES.join(",") },
      })
      .returning()
      .get();
    installId = install.id;
  });

  afterEach(async () => {
    await db.delete(integration).where(eq(integration.id, installId));
    await db
      .delete(incidentEvent)
      .where(eq(incidentEvent.incidentId, incidentId));
    await db
      .delete(auditLog)
      .where(
        and(
          eq(auditLog.entityType, "incident"),
          eq(auditLog.entityId, String(incidentId)),
        ),
      );
    await db.delete(incident).where(eq(incident.id, incidentId));
  });

  async function click() {
    const row = await db
      .select()
      .from(incident)
      .where(eq(incident.id, incidentId))
      .get();
    if (!row) throw new Error("incident gone");
    const { blocks } = incidentSlaNoticeBlocks({
      incident: row,
      kind: "response",
      notice: "warning",
      targetMinutes: 60,
      dueAt,
      url: "https://app.test",
    });
    const button = blocks
      .flatMap((block) => (block.type === "actions" ? block.elements : []))
      .find((e) => e.action_id === INCIDENT_SLA_NOTICE_ACKNOWLEDGE);
    if (!button) throw new Error("no Acknowledge button on the notice");
    return signAndPost(app, {
      type: "block_actions",
      team: { id: teamId },
      user: { id: "U_OWNER" },
      channel: { id: "C_NOTICE" },
      message: { ts: "66.6" },
      actions: [{ action_id: button.action_id, value: button.value }],
    });
  }

  const redrawn = () =>
    slackTestState.calls.find(
      (c) =>
        c.method === "update" &&
        c.args.channel === "C_NOTICE" &&
        c.args.ts === "66.6",
    );

  test("acknowledges as the clicking member and turns the notice into Acknowledged by", async () => {
    const res = await click();
    expect(res.status).toBe(200);
    const row = await db
      .select()
      .from(incident)
      .where(eq(incident.id, incidentId))
      .get();
    expect(row?.acknowledgedAt).toBeInstanceOf(Date);
    expect(row?.responseMetAt).toBeInstanceOf(Date);
    const update = redrawn();
    const blocks = JSON.stringify(update?.args.blocks);
    expect(update?.args.text).toContain("Response due soon");
    expect(blocks).toContain("Acknowledged by <@U_OWNER>");
    expect(blocks).not.toContain("incident_sla_notice_acknowledge");
    expect(blocks).not.toContain("incident_card_update_status");
  });

  test("a notice acknowledged elsewhere names who did it", async () => {
    await db
      .update(incident)
      .set({ acknowledgedAt: new Date(), acknowledgedBy: null })
      .where(eq(incident.id, incidentId));
    await click();
    const ephemeral = slackTestState.calls.find(
      (c) => c.method === "postEphemeral",
    );
    expect(ephemeral?.args.text).toBe("This incident is already acknowledged.");
    const blocks = JSON.stringify(redrawn()?.args.blocks);
    expect(blocks).toContain("Acknowledged by someone else");
    expect(blocks).not.toContain("incident_sla_notice_acknowledge");
  });
});
