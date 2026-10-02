import { db, eq } from "@openstatus/db";
import { incident, integration, user } from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { SLACK_BOT_SCOPES } from "../../integration/slack-scopes";
import type { Workspace } from "../../types";
import {
  afterIncidentClosed,
  afterIncidentDeclared,
  afterIncidentDeleted,
  afterIncidentStatusChanged,
  afterIncidentUpdated,
  afterPostmortemApproved,
  type CommanderEmail,
  declareIncident,
  describeIncidentChanges,
  displayName,
  type IncidentEffects,
  notifyIncidentCommander,
  resolveDashboardUrl,
  type SlackIncidentClient,
  updateIncident,
} from "../index";

type Call = { method: string; args: Record<string, string | boolean | object> };

function fakeSlack() {
  const calls: Call[] = [];
  const record = (method: string, args: Call["args"]) =>
    calls.push({ method, args });
  const client: SlackIncidentClient = {
    conversations: {
      create: async (args) => {
        record("create", args);
        return { ok: true, channel: { id: "C_NEW", name: args.name } };
      },
      invite: async (args) => {
        record("invite", args);
        return { ok: true };
      },
      setTopic: async (args) => {
        record("setTopic", args);
        return { ok: true };
      },
      archive: async (args) => {
        record("archive", args);
        return { ok: true };
      },
    },
    chat: {
      postMessage: async (args) => {
        record("postMessage", args);
        return { ok: true, ts: "1.1" };
      },
    },
    pins: {
      add: async (args) => {
        record("pins.add", args);
        return { ok: true };
      },
    },
    users: {
      lookupByEmail: async (args) => {
        record("lookupByEmail", args);
        throw new Error("users_not_found");
      },
    },
  };
  return { client, calls };
}

function makeEffects(opts: { failEmail?: boolean } = {}) {
  const slack = fakeSlack();
  const emails: CommanderEmail[] = [];
  const effects: IncidentEffects = {
    clientFor: () => slack.client,
    dashboardUrl: "https://dash.test",
    sendCommanderEmail: async (email) => {
      if (opts.failEmail) throw new Error("resend down");
      emails.push(email);
    },
    actorLabel: "Jane",
    assignedBy: "Jane Doe",
  };
  return { effects, emails, calls: slack.calls };
}

let workspace: Workspace;
let ownerId: number;
let memberId: number;
let memberEmail: string;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspace = fixture.workspace;
  ownerId = fixture.userId;
  const member = await createUser();
  memberId = member.id;
  memberEmail = member.email as string;
  await addUserToWorkspace(member.id, workspace.id, "member");
});

const ctxFor = (tx: DB, userId = ownerId): ServiceContext => ({
  ...makeUserCtx(workspace, { userId }),
  db: tx,
});

async function connectSlack(tx: DB) {
  await tx.insert(integration).values({
    name: "slack-agent",
    workspaceId: workspace.id,
    externalId: "T1",
    credential: { botToken: "xoxb-test", botUserId: "UBOT" },
    data: { teamId: "T1", scopes: SLACK_BOT_SCOPES.join(",") },
  });
}

async function bind(tx: DB, incidentId: number) {
  await tx
    .update(incident)
    .set({ slackTeamId: "T1", slackChannelId: "C1" })
    .where(eq(incident.id, incidentId));
}

function declare(tx: DB, commanderId: number | null = null) {
  return declareIncident({
    ctx: ctxFor(tx),
    input: { title: "API down", severity: "major", commanderId },
  });
}

describe("resolveDashboardUrl", () => {
  test("override wins and loses its trailing slash", () => {
    expect(resolveDashboardUrl({ override: "https://x.test/" })).toBe(
      "https://x.test",
    );
  });

  test("falls back by environment", () => {
    expect(resolveDashboardUrl({ nodeEnv: "production" })).toBe(
      "https://app.openstatus.dev",
    );
    expect(resolveDashboardUrl({ nodeEnv: "test", override: "" })).toBe(
      "http://localhost:3001",
    );
  });
});

describe("notifyIncidentCommander", () => {
  test("emails a new commander", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx, memberId);
      const { effects, emails } = makeEffects();
      await notifyIncidentCommander({
        ctx: ctxFor(tx),
        effects,
        incidentId: row.id,
      });
      expect(emails).toHaveLength(1);
      expect(emails[0]).toMatchObject({
        to: memberEmail,
        incidentTitle: "API down",
        severity: "major",
        assignedBy: "Jane Doe",
        url: `https://dash.test/incidents/${row.id}`,
      });
      expect(emails[0]?.idempotencyKey).toBe(
        `incident-commander:${row.id}:${memberId}:${row.updatedAt.getTime()}`,
      );
    });
  });

  test("skips the actor themselves", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx, ownerId);
      const { effects, emails } = makeEffects();
      await notifyIncidentCommander({
        ctx: ctxFor(tx),
        effects,
        incidentId: row.id,
      });
      expect(emails).toHaveLength(0);
    });
  });

  test("skips an incident without a commander", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      const { effects, emails } = makeEffects();
      await notifyIncidentCommander({
        ctx: ctxFor(tx),
        effects,
        incidentId: row.id,
      });
      expect(emails).toHaveLength(0);
    });
  });

  test("a failing sender does not throw", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx, memberId);
      const { effects } = makeEffects({ failEmail: true });
      await notifyIncidentCommander({
        ctx: ctxFor(tx),
        effects,
        incidentId: row.id,
      });
    });
  });
});

describe("afterIncidentDeclared", () => {
  test("no channel unless asked", async () => {
    await withTestTransaction(async (tx) => {
      await connectSlack(tx);
      const row = await declare(tx);
      const { effects, calls, emails } = makeEffects();
      const result = await afterIncidentDeclared({
        ctx: ctxFor(tx),
        effects,
        incident: row,
        openSlackChannel: false,
      });
      expect(result).toBeUndefined();
      expect(calls).toHaveLength(0);
      expect(emails).toHaveLength(0);
    });
  });

  test("opens the channel and emails the commander when asked", async () => {
    await withTestTransaction(async (tx) => {
      await connectSlack(tx);
      const row = await declare(tx, memberId);
      const { effects, calls, emails } = makeEffects();
      const result = await afterIncidentDeclared({
        ctx: ctxFor(tx),
        effects,
        incident: row,
        openSlackChannel: true,
      });
      expect(result?.status).toBe("bound");
      expect(calls.some((c) => c.method === "create")).toBe(true);
      expect(emails).toHaveLength(1);
    });
  });

  test("skips the channel when Slack is not connected", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      const { effects, calls } = makeEffects();
      const result = await afterIncidentDeclared({
        ctx: ctxFor(tx),
        effects,
        incident: row,
        openSlackChannel: true,
      });
      expect(result).toEqual({ status: "skipped" });
      expect(calls).toHaveLength(0);
    });
  });
});

describe("describeIncidentChanges", () => {
  const base = {
    title: "API down",
    summary: null,
    startedAt: new Date("2026-10-01T10:00:00Z"),
    severity: "major" as const,
    commanderId: null,
  };

  test("lists every changed field", () => {
    const changes = describeIncidentChanges(
      base,
      {
        title: "API <really> down",
        summary: "s",
        startedAt: new Date("2026-10-01T09:00:00Z"),
        severity: "critical",
        commanderId: 7,
      },
      "Ann",
    );
    expect(changes).toEqual([
      "title is now *API &lt;really&gt; down*",
      "summary was updated",
      `start time is now <!date^${Date.UTC(2026, 9, 1, 9) / 1000}^{date_short_pretty} {time}|2026-10-01T09:00:00.000Z>`,
      "severity is now *critical*",
      "Ann is now commander",
    ]);
  });

  test("reports removals and nothing for no change", () => {
    expect(describeIncidentChanges(base, base, null)).toEqual([]);
    expect(
      describeIncidentChanges(
        { ...base, summary: "s", commanderId: 7 },
        base,
        null,
      ),
    ).toEqual(["summary was removed", "there is no commander"]);
  });
});

describe("channel announcements", () => {
  test("nothing is posted for an unbound incident", async () => {
    await withTestTransaction(async (tx) => {
      await connectSlack(tx);
      const row = await declare(tx);
      const { effects, calls } = makeEffects();
      await afterIncidentStatusChanged({
        ctx: ctxFor(tx),
        effects,
        incidentId: row.id,
        status: "canceled",
      });
      expect(calls).toHaveLength(0);
    });
  });

  test("a status change posts and refreshes the topic", async () => {
    await withTestTransaction(async (tx) => {
      await connectSlack(tx);
      const row = await declare(tx);
      await bind(tx, row.id);
      const { effects, calls } = makeEffects();
      await afterIncidentStatusChanged({
        ctx: ctxFor(tx),
        effects,
        incidentId: row.id,
        status: "mitigated",
        note: "rolled back",
      });
      expect(calls.map((c) => c.method)).toEqual(["postMessage", "setTopic"]);
      expect(calls[0]?.args.text).toBe(
        "Jane marked the incident *mitigated*.\n>rolled back",
      );
    });
  });

  test("cancel, close, approve-with-close and delete archive", async () => {
    await withTestTransaction(async (tx) => {
      await connectSlack(tx);
      const row = await declare(tx);
      await bind(tx, row.id);
      const ctx = ctxFor(tx);
      const archives = async (run: (e: IncidentEffects) => Promise<void>) => {
        const { effects, calls } = makeEffects();
        await run(effects);
        return calls.some((c) => c.method === "archive");
      };
      expect(
        await archives((effects) =>
          afterIncidentStatusChanged({
            ctx,
            effects,
            incidentId: row.id,
            status: "canceled",
          }),
        ),
      ).toBe(true);
      expect(
        await archives((effects) =>
          afterIncidentClosed({ ctx, effects, incidentId: row.id }),
        ),
      ).toBe(true);
      expect(
        await archives((effects) =>
          afterPostmortemApproved({
            ctx,
            effects,
            incidentId: row.id,
            closed: true,
          }),
        ),
      ).toBe(true);
      expect(
        await archives((effects) =>
          afterPostmortemApproved({
            ctx,
            effects,
            incidentId: row.id,
            closed: false,
          }),
        ),
      ).toBe(false);
      expect(
        await archives((effects) =>
          afterIncidentDeleted({
            ctx,
            effects,
            before: { ...row, slackTeamId: "T1", slackChannelId: "C1" },
          }),
        ),
      ).toBe(true);
    });
  });

  test("a channel from another Slack team is left alone", async () => {
    await withTestTransaction(async (tx) => {
      await connectSlack(tx);
      const row = await declare(tx);
      const { effects, calls } = makeEffects();
      await afterIncidentDeleted({
        ctx: ctxFor(tx),
        effects,
        before: { ...row, slackTeamId: "T_OTHER", slackChannelId: "C1" },
      });
      expect(calls).toHaveLength(0);
    });
  });

  test("an update announces its changes and emails the new commander", async () => {
    await withTestTransaction(async (tx) => {
      await connectSlack(tx);
      const before = await declare(tx);
      await bind(tx, before.id);
      const after = await updateIncident({
        ctx: ctxFor(tx),
        input: { id: before.id, severity: "critical", commanderId: memberId },
      });
      const { effects, calls, emails } = makeEffects();
      await afterIncidentUpdated({ ctx: ctxFor(tx), effects, before, after });
      expect(emails).toHaveLength(1);
      const member = await tx
        .select({
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        })
        .from(user)
        .where(eq(user.id, memberId))
        .get();
      expect(member).toBeDefined();
      expect(calls[0]?.args.text).toBe(
        `Jane: severity is now *critical*, ${member ? displayName(member) : ""} is now commander.`,
      );
    });
  });
});

describe("cleanup", () => {
  test("leaves no integration behind", async () => {
    const rows = await db
      .select({ id: integration.id })
      .from(integration)
      .where(eq(integration.workspaceId, workspace.id))
      .all();
    expect(rows).toHaveLength(0);
  });
});
