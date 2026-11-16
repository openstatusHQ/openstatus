import { eq } from "@openstatus/db";
import { incident, integration } from "@openstatus/db/src/schema";
import { createSlackUser } from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
  postOnlySlackClient,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { upsertIncidentReporting } from "../../incident-reporting";
import { SLACK_BOT_SCOPES } from "../../integration/slack-scopes";
import type { Workspace } from "../../types";
import {
  acknowledgeIncident,
  declareIncident,
  recordIncidentSlaBreaches,
  sendIncidentSlaNotices,
  type SlackIncidentClient,
  updateIncident,
} from "../index";
import { incidentSlaNoticeCopy } from "../sla-notice-copy";

let team: Workspace;
let ownerId: number;

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
const owner = (tx: DB) => withDb(makeUserCtx(team, { userId: ownerId }), tx);
const apiKey = (tx: DB) =>
  withDb(makeApiKeyCtx(team, { keyId: "k_notice" }), tx);

const TARGETS = {
  critical: { responseMinutes: 60, resolutionMinutes: 240 },
  major: { responseMinutes: 80, resolutionMinutes: 1440 },
};

async function policy(
  tx: DB,
  responseMet: "acknowledged" | "status_report" = "acknowledged",
) {
  await upsertIncidentReporting({
    ctx: owner(tx),
    input: {
      targets: TARGETS,
      resolutionStop: "mitigated",
      responseMet,
    },
  });
}

// Declared by an API key, so nothing acknowledges it. The DB stores seconds.
async function declare(
  tx: DB,
  args: {
    minutesAgo: number;
    teamId?: string;
    channel?: string | null;
    commanderId?: number;
    responseMet?: "acknowledged" | "status_report";
  },
) {
  await policy(tx, args.responseMet);
  const declared = await declareIncident({
    ctx: apiKey(tx),
    input: { title: "Checkout <down>", severity: "critical" },
  });
  const declaredAt = new Date(
    Math.floor((Date.now() - args.minutesAgo * MINUTE) / 1000) * 1000,
  );
  await tx
    .update(incident)
    .set({
      declaredAt,
      commanderId: args.commanderId ?? null,
      ...(args.channel === null
        ? {}
        : {
            slackTeamId: args.teamId,
            slackChannelId: args.channel ?? "C_SLA",
          }),
    })
    .where(eq(incident.id, declared.id));
  return { id: declared.id, declaredAt };
}

async function connect(tx: DB) {
  const teamId = `T_SLA_${crypto.randomUUID()}`;
  await tx.insert(integration).values({
    name: "slack-agent",
    workspaceId: team.id,
    externalId: teamId,
    credential: { botToken: "xoxb-test", botUserId: "UBOT" },
    data: { teamId, scopes: SLACK_BOT_SCOPES.join(",") },
  });
  return teamId;
}

type Sent = { channel: string; text: string; blocks?: unknown[] };

function fakeClient(fail?: (call: number) => unknown) {
  const sent: Sent[] = [];
  let calls = 0;
  const client = postOnlySlackClient(async (args) => {
    calls++;
    const error = fail?.(calls);
    if (error) throw error;
    sent.push(args);
    return { ok: true, ts: "1.1" };
  });
  return { client, sent };
}

function notices(
  tx: DB,
  client: SlackIncidentClient,
  args: {
    now?: Date;
    breaches?: Awaited<ReturnType<typeof record>>;
  } = {},
) {
  return sendIncidentSlaNotices({
    db: tx,
    clientFor: () => client,
    dashboardUrl: "https://app.test",
    workspaceIds: [team.id],
    breaches: args.breaches ?? [],
    now: args.now,
  });
}

const record = (tx: DB, now?: Date) =>
  recordIncidentSlaBreaches({ db: tx, workspaceIds: [team.id], now });

const summary = (results: Awaited<ReturnType<typeof notices>>) =>
  results.map((r) => [r.incident.id, r.kind, r.notice, r.outcome]);

const temporary = () =>
  Object.assign(new Error("socket hang up"), {
    code: "slack_webapi_request_error",
  });
const permanent = () =>
  Object.assign(new Error("channel_not_found"), {
    code: "slack_webapi_platform_error",
  });

describe("warnings", () => {
  test("one warning at 75% of the target, to the bound channel, with an Acknowledge button", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      const { id, declaredAt } = await declare(tx, { minutesAgo: 50, teamId });
      const { client, sent } = fakeClient();

      expect(summary(await notices(tx, client))).toEqual([
        [id, "response", "warning", "sent"],
      ]);
      expect(summary(await notices(tx, client))).toEqual([]);
      expect(sent).toHaveLength(1);
      expect(sent[0]?.channel).toBe("C_SLA");
      expect(sent[0]?.text).toBe("Response due soon: Checkout &lt;down&gt;");
      const blocks = JSON.stringify(sent[0]?.blocks);
      expect(blocks).toContain("*Checkout &lt;down&gt;* (critical)");
      expect(blocks).toContain(
        `<!date^${(declaredAt.getTime() + 60 * MINUTE) / 1000}^`,
      );
      expect(blocks).toContain("incident_sla_notice_acknowledge");
      expect(blocks).not.toContain("incident_card_acknowledge");
    });
  });

  test("a due time moved by a severity change warns again", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      const { id, declaredAt } = await declare(tx, { minutesAgo: 50, teamId });
      const { client, sent } = fakeClient();
      const at = (minutes: number) =>
        new Date(declaredAt.getTime() + minutes * MINUTE);

      await notices(tx, client, { now: at(50) });
      await updateIncident({
        ctx: apiKey(tx),
        input: { id, severity: "major" },
      });
      expect(summary(await notices(tx, client, { now: at(58) }))).toEqual([]);
      expect(summary(await notices(tx, client, { now: at(65) }))).toEqual([
        [id, "response", "warning", "sent"],
      ]);
      expect(sent).toHaveLength(2);
    });
  });

  test("no warning once the target is missed", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      await declare(tx, { minutesAgo: 61, teamId });
      const { client, sent } = fakeClient();
      expect(summary(await notices(tx, client))).toEqual([]);
      expect(sent).toHaveLength(0);
    });
  });

  test("resolution warning names the stop state and has no Acknowledge button", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      const { id } = await declare(tx, { minutesAgo: 200, teamId });
      await acknowledgeIncident({ ctx: owner(tx), input: { id } });
      const { client, sent } = fakeClient();
      expect(summary(await notices(tx, client))).toEqual([
        [id, "resolution", "warning", "sent"],
      ]);
      const blocks = JSON.stringify(sent[0]?.blocks);
      expect(blocks).toContain("Mitigate or resolve it before then.");
      expect(blocks).not.toContain("incident_sla_notice_acknowledge");
    });
  });
});

describe("misses", () => {
  test("sent once by the tick that records the miss", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      const { id } = await declare(tx, { minutesAgo: 61, teamId });
      const { client, sent } = fakeClient();
      const breaches = await record(tx);
      expect(summary(await notices(tx, client, { breaches }))).toEqual([
        [id, "response", "miss", "sent"],
      ]);
      expect(summary(await notices(tx, client))).toEqual([]);
      expect(sent[0]?.text).toBe(
        "Response target missed: Checkout &lt;down&gt;",
      );
      expect(JSON.stringify(sent[0]?.blocks)).toContain(
        "incident_sla_notice_acknowledge",
      );
    });
  });

  test("no miss notice when the target was met late", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      const { id } = await declare(tx, { minutesAgo: 61, teamId });
      await acknowledgeIncident({ ctx: owner(tx), input: { id } });
      const { client, sent } = fakeClient();
      expect(summary(await notices(tx, client))).toEqual([]);
      expect(sent).toHaveLength(0);
    });
  });

  test("no miss notice when the target is met between the stamp and the send", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      const { id } = await declare(tx, { minutesAgo: 61, teamId });
      const breaches = await record(tx);
      expect(breaches).toHaveLength(1);
      await acknowledgeIncident({ ctx: owner(tx), input: { id } });
      const { client, sent } = fakeClient();
      expect(summary(await notices(tx, client, { breaches }))).toEqual([]);
      expect(sent).toHaveLength(0);
    });
  });

  test("a miss recorded late, due more than a day ago, still sends once", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      const { id } = await declare(tx, { minutesAgo: 2 * 24 * 60, teamId });
      const { client, sent } = fakeClient();
      const breaches = await record(tx);
      expect(summary(await notices(tx, client, { breaches }))).toEqual([
        [id, "response", "miss", "sent"],
        [id, "resolution", "miss", "sent"],
      ]);
      expect(summary(await notices(tx, client))).toEqual([]);
      expect(sent).toHaveLength(2);
    });
  });

  test("a temporary Slack failure is retried on the next tick", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      const { id } = await declare(tx, { minutesAgo: 61, teamId });
      const { client, sent } = fakeClient((call) =>
        call === 1 ? temporary() : null,
      );
      const breaches = await record(tx);
      expect(summary(await notices(tx, client, { breaches }))).toEqual([
        [id, "response", "miss", "retry"],
      ]);
      expect(summary(await notices(tx, client))).toEqual([
        [id, "response", "miss", "sent"],
      ]);
      expect(sent).toHaveLength(1);
    });
  });

  test("a permanent Slack failure is not retried", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      const { id } = await declare(tx, { minutesAgo: 61, teamId });
      const { client, sent } = fakeClient((call) =>
        call === 1 ? permanent() : null,
      );
      const breaches = await record(tx);
      expect(summary(await notices(tx, client, { breaches }))).toEqual([
        [id, "response", "miss", "refused"],
      ]);
      expect(summary(await notices(tx, client))).toEqual([]);
      expect(sent).toHaveLength(0);
    });
  });
});

describe("delivery reports whether a Slack message went out", () => {
  test("no Slack connection, reported once", async () => {
    await withTestTransaction(async (tx) => {
      const { id } = await declare(tx, { minutesAgo: 50, channel: null });
      const { client, sent } = fakeClient();
      const results = await notices(tx, client);
      expect(summary(results)).toEqual([
        [id, "response", "warning", "no_connection"],
      ]);
      expect(results[0]?.target).toBeNull();
      expect(summary(await notices(tx, client))).toEqual([]);
      expect(sent).toHaveLength(0);
    });
  });

  test("nobody to reach", async () => {
    await withTestTransaction(async (tx) => {
      await connect(tx);
      const { id } = await declare(tx, { minutesAgo: 50, channel: null });
      const { client } = fakeClient();
      expect(summary(await notices(tx, client))).toEqual([
        [id, "response", "warning", "no_target"],
      ]);
    });
  });

  test("a DM to the commander says who it is for", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      await createSlackUser(
        team.id,
        ownerId,
        { slackTeamId: teamId, slackUserId: "U_CMD" },
        tx,
      );
      await declare(tx, {
        minutesAgo: 50,
        channel: null,
        commanderId: ownerId,
      });
      const { client, sent } = fakeClient();
      const [result] = await notices(tx, client);
      expect(result?.target).toEqual({
        kind: "dm",
        slackUserId: "U_CMD",
        role: "commander",
      });
      expect(sent[0]?.channel).toBe("U_CMD");
      expect(JSON.stringify(sent[0]?.blocks)).toContain(
        "You are the commander of this incident.",
      );
    });
  });
});

describe("status report mode", () => {
  test("response notices ask for a status update and carry no Acknowledge button", async () => {
    await withTestTransaction(async (tx) => {
      const teamId = await connect(tx);
      await declare(tx, {
        minutesAgo: 50,
        teamId,
        responseMet: "status_report",
      });
      const { client, sent } = fakeClient();
      await notices(tx, client);
      const blocks = JSON.stringify(sent[0]?.blocks);
      expect(blocks).toContain("Post a status report update before then.");
      expect(blocks).not.toContain("Acknowledge");
    });
  });
});

describe("incidentSlaNoticeCopy", () => {
  const plain = {
    strong: (text: string) => text,
    time: (date: Date) => date.toISOString(),
  };
  const base = {
    title: "Checkout down",
    severity: "critical" as const,
    targetMinutes: 90,
    dueAt: new Date("2026-11-11T20:50:00Z"),
    responseMet: "acknowledged" as const,
    resolutionStop: "resolved" as const,
  };

  test("plain wording for email", () => {
    expect(
      incidentSlaNoticeCopy(
        { ...base, kind: "response", notice: "warning" },
        plain,
      ),
    ).toEqual({
      headline: "Response due soon",
      body: "Checkout down (critical) has a 1h 30m response target due 2026-11-11T20:50:00.000Z.",
      action: "Acknowledge it before then.",
    });
    expect(
      incidentSlaNoticeCopy(
        { ...base, kind: "resolution", notice: "miss" },
        plain,
      ),
    ).toEqual({
      headline: "Resolution target missed",
      body: "Checkout down (critical) missed its 1h 30m resolution target, due 2026-11-11T20:50:00.000Z.",
      action: null,
    });
    expect(
      incidentSlaNoticeCopy(
        { ...base, kind: "resolution", notice: "warning" },
        plain,
      ).action,
    ).toBe("Resolve it before then.");
    expect(
      incidentSlaNoticeCopy(
        {
          ...base,
          kind: "response",
          notice: "miss",
          responseMet: "status_report",
        },
        plain,
      ).action,
    ).toBe("Post a status report update now.");
  });
});
