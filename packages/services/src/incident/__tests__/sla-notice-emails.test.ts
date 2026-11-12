import { and, eq } from "@openstatus/db";
import {
  incident,
  incidentEvent,
  integration,
  user,
} from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
  postOnlySlackClient,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { upsertIncidentSlaPolicy } from "../../incident-sla-policy";
import { SLACK_BOT_SCOPES } from "../../integration/slack-scopes";
import type { Workspace } from "../../types";
import {
  declareIncident,
  emailIncidentSlaNotices,
  type IncidentSlaNoticeEmail,
  recordIncidentMissedUpdates,
  recordIncidentSlaBreaches,
  sendIncidentSlaNotices,
  type SlackIncidentClient,
} from "../index";

let team: Workspace;
let ownerId: number;
let ownerEmail: string;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  team = fixture.workspace;
  ownerId = fixture.userId;
});

const MINUTE = 60_000;
const withDb = (ctx: ServiceContext, tx: DB): ServiceContext => ({
  ...ctx,
  db: tx,
});

async function declare(
  tx: DB,
  args: {
    minutesAgo: number;
    commanderId?: number | null;
    declaredBy?: number | null;
    teamId?: string;
    targets?: Record<string, Record<string, number>>;
  },
) {
  await upsertIncidentSlaPolicy({
    ctx: withDb(makeUserCtx(team, { userId: ownerId }), tx),
    input: {
      targets: args.targets ?? {
        critical: { responseMinutes: 60, resolutionMinutes: 240 },
      },
      resolutionStop: "mitigated",
    },
  });
  const declared = await declareIncident({
    ctx: withDb(makeApiKeyCtx(team, { keyId: "k_email" }), tx),
    input: { title: "Checkout down", severity: "critical" },
  });
  const declaredAt = new Date(
    Math.floor((Date.now() - args.minutesAgo * MINUTE) / 1000) * 1000,
  );
  await tx
    .update(incident)
    .set({
      declaredAt,
      commanderId: args.commanderId ?? null,
      declaredBy: args.declaredBy ?? null,
      ...(args.teamId
        ? { slackTeamId: args.teamId, slackChannelId: "C_SLA" }
        : {}),
    })
    .where(eq(incident.id, declared.id));
  if (args.declaredBy) {
    // a person's declare, left unacknowledged so its timers run
    await tx
      .update(incidentEvent)
      .set({ source: "dashboard", createdBy: args.declaredBy })
      .where(
        and(
          eq(incidentEvent.incidentId, declared.id),
          eq(incidentEvent.type, "declared"),
        ),
      );
  }
  return { id: declared.id, declaredAt };
}

async function connect(tx: DB) {
  const teamId = `T_MAIL_${crypto.randomUUID()}`;
  await tx.insert(integration).values({
    name: "slack-agent",
    workspaceId: team.id,
    externalId: teamId,
    credential: { botToken: "xoxb-test", botUserId: "UBOT" },
    data: { teamId, scopes: SLACK_BOT_SCOPES.join(",") },
  });
  return teamId;
}

async function member(
  tx: DB,
  role: "owner" | "admin" | "member",
  overrides: { email?: string; deletedAt?: Date } = {},
) {
  const u = await createUser(overrides, tx);
  await addUserToWorkspace(u.id, team.id, role, tx);
  return u;
}

function slack(fail?: () => unknown) {
  return postOnlySlackClient(async () => {
    const error = fail?.();
    if (error) throw error;
    return { ok: true, ts: "1.1" };
  });
}

async function tick(
  tx: DB,
  opts: { client?: SlackIncidentClient; record?: boolean } = {},
) {
  const breaches = opts.record
    ? await recordIncidentSlaBreaches({ db: tx, workspaceIds: [team.id] })
    : [];
  const missedUpdates = opts.record
    ? await recordIncidentMissedUpdates({ db: tx, workspaceIds: [team.id] })
    : [];
  const results = await sendIncidentSlaNotices({
    db: tx,
    clientFor: () => opts.client ?? slack(),
    dashboardUrl: "https://app.test",
    workspaceIds: [team.id],
    breaches,
    missedUpdates,
  });
  const sent: IncidentSlaNoticeEmail[] = [];
  const emailed = await emailIncidentSlaNotices({
    db: tx,
    notices: results,
    dashboardUrl: "https://app.test",
    send: async (email) => {
      sent.push(email);
    },
  });
  return { results, emailed, sent };
}

async function emailOf(tx: DB, id: number) {
  const row = await tx.select().from(user).where(eq(user.id, id)).get();
  return row?.email ?? "";
}

describe("email when Slack cannot deliver", () => {
  test("no Slack connection: the commander and declarer get one email with a link", async () => {
    await withTestTransaction(async (tx) => {
      ownerEmail = await emailOf(tx, ownerId);
      const declarer = await member(tx, "member");
      const { id, declaredAt } = await declare(tx, {
        minutesAgo: 50,
        commanderId: ownerId,
        declaredBy: declarer.id,
      });
      const { sent, emailed } = await tick(tx);
      expect(emailed.map((e) => e.outcome)).toEqual(["sent"]);
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({
        to: [ownerEmail, declarer.email],
        idempotencyKey: `incident-sla-notice:${id}:response:warning:${declaredAt.getTime() + 60 * MINUTE}`,
        notice: "warning",
        headline: "Response due soon",
        action: "Acknowledge it before then.",
        incidentTitle: "Checkout down",
        severity: "critical",
        target: "1h",
        audience: "incident",
        url: `https://app.test/incidents/${id}`,
      });
      expect(sent[0]?.body).toMatch(
        /^Checkout down \(critical\) has a 1h response target due .+ UTC\.$/,
      );
    });
  });

  test("commander and declarer are the same person: one address", async () => {
    await withTestTransaction(async (tx) => {
      await declare(tx, {
        minutesAgo: 50,
        commanderId: ownerId,
        declaredBy: ownerId,
      });
      const { sent } = await tick(tx);
      expect(sent[0]?.to).toEqual([await emailOf(tx, ownerId)]);
    });
  });

  test("deleted users and users without an email are skipped, with no fallback", async () => {
    await withTestTransaction(async (tx) => {
      const gone = await member(tx, "admin", { deletedAt: new Date() });
      const blank = await member(tx, "admin", { email: "" });
      await declare(tx, {
        minutesAgo: 50,
        commanderId: gone.id,
        declaredBy: blank.id,
      });
      const { sent, emailed } = await tick(tx);
      expect(emailed.map((e) => e.outcome)).toEqual(["no_recipients"]);
      expect(sent).toHaveLength(0);
    });
  });

  test("nobody assigned: owners and admins, not members or deleted admins", async () => {
    await withTestTransaction(async (tx) => {
      const admin = await member(tx, "admin");
      await member(tx, "member");
      await member(tx, "admin", { deletedAt: new Date() });
      await declare(tx, { minutesAgo: 50 });
      const { sent } = await tick(tx);
      expect(sent).toHaveLength(1);
      expect(sent[0]?.audience).toBe("workspace");
      expect([...(sent[0]?.to ?? [])].sort()).toEqual(
        [await emailOf(tx, ownerId), admin.email].sort(),
      );
    });
  });

  test("declared by a user's API key with nobody assigned: owners and admins, not the key's creator", async () => {
    await withTestTransaction(async (tx) => {
      const admin = await member(tx, "admin");
      const creator = await member(tx, "member");
      await upsertIncidentSlaPolicy({
        ctx: withDb(makeUserCtx(team, { userId: ownerId }), tx),
        input: {
          targets: {
            critical: { responseMinutes: 60, resolutionMinutes: 240 },
          },
          resolutionStop: "mitigated",
        },
      });
      const declared = await declareIncident({
        ctx: withDb(
          makeApiKeyCtx(team, { keyId: "k_user", userId: creator.id }),
          tx,
        ),
        input: { title: "Checkout down", severity: "critical" },
      });
      expect(declared.declaredBy).toBe(creator.id);
      await tx
        .update(incident)
        .set({
          declaredAt: new Date(
            Math.floor((Date.now() - 50 * MINUTE) / 1000) * 1000,
          ),
        })
        .where(eq(incident.id, declared.id));

      const { sent } = await tick(tx);
      expect(sent).toHaveLength(1);
      expect(sent[0]?.audience).toBe("workspace");
      expect([...(sent[0]?.to ?? [])].sort()).toEqual(
        [await emailOf(tx, ownerId), admin.email].sort(),
      );
    });
  });

  test("nobody to reach in Slack and a permanent refusal both email", async () => {
    await withTestTransaction(async (tx) => {
      await connect(tx);
      await declare(tx, { minutesAgo: 50, commanderId: ownerId });
      const first = await tick(tx);
      expect(first.results.map((r) => r.outcome)).toEqual(["no_target"]);
      expect(first.sent).toHaveLength(1);
    });
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      await declare(tx, { minutesAgo: 61, commanderId: ownerId, teamId });
      const refused = await tick(tx, {
        record: true,
        client: slack(() =>
          Object.assign(new Error("channel_not_found"), {
            code: "slack_webapi_platform_error",
          }),
        ),
      });
      expect(refused.results.map((r) => r.outcome)).toEqual(["refused"]);
      expect(refused.sent.map((s) => s.headline)).toEqual([
        "Response target missed",
      ]);
    });
  });

  test("no email when Slack sent it, nor for a temporary failure", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      await declare(tx, { minutesAgo: 50, commanderId: ownerId, teamId });
      const delivered = await tick(tx);
      expect(delivered.results.map((r) => r.outcome)).toEqual(["sent"]);
      expect(delivered.sent).toHaveLength(0);
    });
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      await declare(tx, { minutesAgo: 50, commanderId: ownerId, teamId });
      const retry = await tick(tx, {
        client: slack(() =>
          Object.assign(new Error("socket hang up"), {
            code: "slack_webapi_request_error",
          }),
        ),
      });
      expect(retry.results.map((r) => r.outcome)).toEqual(["retry"]);
      expect(retry.sent).toHaveLength(0);
      expect(retry.emailed).toHaveLength(0);
    });
  });

  test("each notice is emailed once, even when two machines hold the same result", async () => {
    await withTestTransaction(async (tx) => {
      await declare(tx, { minutesAgo: 50, commanderId: ownerId });
      const { results, sent } = await tick(tx);
      const other: IncidentSlaNoticeEmail[] = [];
      const again = await emailIncidentSlaNotices({
        db: tx,
        notices: results,
        dashboardUrl: "https://app.test",
        send: async (email) => {
          other.push(email);
        },
      });
      expect(sent).toHaveLength(1);
      expect(again).toEqual([]);
      expect(other).toHaveLength(0);
    });
  });

  test("update notices: emailed when Slack cannot deliver, not when it did", async () => {
    const updatesOnly = { critical: { updateMinutes: 60 } };
    await withTestTransaction(async (tx) => {
      const { id, declaredAt } = await declare(tx, {
        minutesAgo: 61,
        commanderId: ownerId,
        targets: updatesOnly,
      });
      const { results, sent } = await tick(tx, { record: true });
      expect(results.map((r) => [r.kind, r.notice, r.outcome])).toEqual([
        ["update", "miss", "no_connection"],
      ]);
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({
        to: [await emailOf(tx, ownerId)],
        idempotencyKey: `incident-sla-notice:${id}:update:miss:${declaredAt.getTime() + 60 * MINUTE}`,
        notice: "miss",
        headline: "Update overdue",
        action: "Post a status report update or a note now.",
        target: "every 1h",
      });
      expect(sent[0]?.body).toMatch(
        /^The update on Checkout down \(critical\) was due .+ UTC \(every 1h\)\.$/,
      );
    });
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      await declare(tx, {
        minutesAgo: 50,
        commanderId: ownerId,
        teamId,
        targets: updatesOnly,
      });
      const { results, sent } = await tick(tx, { record: true });
      expect(results.map((r) => [r.kind, r.notice, r.outcome])).toEqual([
        ["update", "warning", "sent"],
      ]);
      expect(sent).toHaveLength(0);
    });
  });
});
