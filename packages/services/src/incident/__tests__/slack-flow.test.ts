import { integration } from "@openstatus/db/src/schema";
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
  announceIncidentChange,
  declareIncident,
  getIncident,
  headerBlocks,
  incidentChannelName,
  listIncidentEvents,
  openIncidentSlackChannel,
  type SlackIncidentClient,
} from "../index";

type Call = { method: string; args: Record<string, string | boolean | object> };

function fakeSlack(
  opts: {
    takenNames?: string[];
    emails?: Record<string, string>;
  } = {},
) {
  const calls: Call[] = [];
  const record = (method: string, args: Call["args"]) =>
    calls.push({ method, args });
  const client: SlackIncidentClient = {
    conversations: {
      create: async (args) => {
        record("create", args);
        if (opts.takenNames?.includes(args.name)) {
          throw Object.assign(new Error("An API error occurred: name_taken"), {
            data: { error: "name_taken" },
          });
        }
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
        const id = opts.emails?.[args.email];
        if (!id) throw new Error("users_not_found");
        return { ok: true, user: { id } };
      },
    },
  };
  return { client, calls };
}

let workspace: Workspace;
let ownerId: number;
let memberEmail: string;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspace = fixture.workspace;
  ownerId = fixture.userId;
  const member = await createUser();
  memberEmail = member.email as string;
  await addUserToWorkspace(member.id, workspace.id, "member");
});

async function connectSlack(tx: DB, teamId: string, scopes: string) {
  await tx.insert(integration).values({
    name: "slack-agent",
    workspaceId: workspace.id,
    externalId: teamId,
    credential: { botToken: "xoxb-test", botUserId: "UBOT" },
    data: { teamId, scopes },
  });
}

const ctxFor = (tx: DB): ServiceContext => ({
  ...makeUserCtx(workspace, { userId: ownerId }),
  db: tx,
});

describe("incidentChannelName", () => {
  const declaredAt = new Date("2026-09-28T23:30:00Z");
  test("UTC date, slug, suffix on retry", () => {
    expect(incidentChannelName({ title: "API is DOWN!", declaredAt })).toBe(
      "inc-2026-09-28-api-is-down",
    );
    expect(incidentChannelName({ title: "API is DOWN!", declaredAt }, 3)).toBe(
      "inc-2026-09-28-api-is-down-3",
    );
  });

  test("stays within 80 chars and falls back when nothing is left", () => {
    const long = incidentChannelName({ title: "x".repeat(200), declaredAt }, 2);
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith("-2")).toBe(true);
    expect(incidentChannelName({ title: "🔥🔥", declaredAt })).toBe(
      "inc-2026-09-28-incident",
    );
  });
});

describe("openIncidentSlackChannel", () => {
  test("creates, links members by email, invites, pins and binds", async () => {
    await withTestTransaction(async (tx) => {
      await connectSlack(tx, "T_FLOW", SLACK_BOT_SCOPES.join(","));
      const ctx = ctxFor(tx);
      const inc = await declareIncident({
        ctx,
        input: { title: "Checkout down", severity: "critical" },
      });
      const name = incidentChannelName(inc);
      const { client, calls } = fakeSlack({
        takenNames: [name],
        emails: { [memberEmail]: "U_MEMBER" },
      });

      const result = await openIncidentSlackChannel({
        ctx,
        incidentId: inc.id,
        clientFor: () => client,
        dashboardUrl: "https://app.test",
      });

      expect(result).toEqual({ status: "bound", channelId: "C_NEW" });
      const creates = calls.filter((c) => c.method === "create");
      expect(creates.map((c) => c.args.name)).toEqual([name, `${name}-2`]);
      const invite = calls.find((c) => c.method === "invite");
      expect(String(invite?.args.users)).toContain("U_MEMBER");
      expect(calls.some((c) => c.method === "pins.add")).toBe(true);

      const bound = await getIncident({ ctx, input: { id: inc.id } });
      expect(bound?.slackChannelId).toBe("C_NEW");
      expect(bound?.slackTeamId).toBe("T_FLOW");
      const events = await listIncidentEvents({ ctx, input: { id: inc.id } });
      expect(events[0].type).toBe("slack_channel_bound");
    });
  });

  test("skips an install that is missing scopes", async () => {
    await withTestTransaction(async (tx) => {
      await connectSlack(tx, "T_OLD", "chat:write");
      const ctx = ctxFor(tx);
      const inc = await declareIncident({
        ctx,
        input: { title: "x", severity: "minor" },
      });
      const { client, calls } = fakeSlack();
      const result = await openIncidentSlackChannel({
        ctx,
        incidentId: inc.id,
        clientFor: () => client,
        dashboardUrl: "https://app.test",
      });
      expect(result.status).toBe("skipped");
      expect(calls).toHaveLength(0);
    });
  });

  test("a channel create failure leaves the incident intact", async () => {
    await withTestTransaction(async (tx) => {
      await connectSlack(tx, "T_FAIL", SLACK_BOT_SCOPES.join(","));
      const ctx = ctxFor(tx);
      const inc = await declareIncident({
        ctx,
        input: { title: "x", severity: "minor" },
      });
      const { client } = fakeSlack();
      client.conversations.create = async () => {
        throw Object.assign(new Error("restricted_action"), {
          data: { error: "restricted_action" },
        });
      };
      const result = await openIncidentSlackChannel({
        ctx,
        incidentId: inc.id,
        clientFor: () => client,
        dashboardUrl: "https://app.test",
      });
      expect(result).toEqual({ status: "failed", error: "restricted_action" });
      expect(
        (await getIncident({ ctx, input: { id: inc.id } }))?.slackChannelId,
      ).toBeNull();
    });
  });

  test("a bind failure posts the link-this-channel card", async () => {
    await withTestTransaction(async (tx) => {
      await connectSlack(tx, "T_BIND", SLACK_BOT_SCOPES.join(","));
      const ctx = ctxFor(tx);
      const first = await declareIncident({
        ctx,
        input: { title: "first", severity: "minor" },
      });
      const second = await declareIncident({
        ctx,
        input: { title: "second", severity: "minor" },
      });
      const { client } = fakeSlack();
      await openIncidentSlackChannel({
        ctx,
        incidentId: first.id,
        clientFor: () => client,
        dashboardUrl: "https://app.test",
      });
      const { client: again, calls } = fakeSlack();
      const result = await openIncidentSlackChannel({
        ctx,
        incidentId: second.id,
        clientFor: () => again,
        dashboardUrl: "https://app.test",
      });
      expect(result.status).toBe("unbound");
      const card = calls.findLast((c) => c.method === "postMessage");
      expect(JSON.stringify(card?.args.blocks)).toContain(
        `incident_bind_${second.id}`,
      );
    });
  });
});

describe("announceIncidentChange", () => {
  async function boundIncident(tx: DB, teamId: string) {
    await connectSlack(tx, teamId, SLACK_BOT_SCOPES.join(","));
    const ctx = ctxFor(tx);
    const inc = await declareIncident({
      ctx,
      input: { title: "x", severity: "minor" },
    });
    const { client } = fakeSlack();
    await openIncidentSlackChannel({
      ctx,
      incidentId: inc.id,
      clientFor: () => client,
      dashboardUrl: "https://app.test",
    });
    return { ctx, inc };
  }

  test("posts and refreshes the topic", async () => {
    await withTestTransaction(async (tx) => {
      const { ctx, inc } = await boundIncident(tx, "T_ANN");
      const { client: later, calls } = fakeSlack();
      await announceIncidentChange({
        ctx,
        incidentId: inc.id,
        text: "Severity is now major",
        clientFor: () => later,
        dashboardUrl: "https://app.test",
      });
      expect(calls.map((c) => c.method)).toEqual(["postMessage", "setTopic"]);
      expect(calls[1].args.topic).toContain(
        `https://app.test/incidents/${inc.id}`,
      );
    });
  });

  test("posts then archives on request, without a topic refresh", async () => {
    await withTestTransaction(async (tx) => {
      const { ctx, inc } = await boundIncident(tx, "T_ANN_ARCHIVE");
      const { client: later, calls } = fakeSlack();
      await announceIncidentChange({
        ctx,
        incidentId: inc.id,
        text: "Resolved",
        clientFor: () => later,
        dashboardUrl: "https://app.test",
        archive: true,
      });
      expect(calls.map((c) => c.method)).toEqual(["postMessage", "archive"]);
    });
  });
});

describe("headerBlocks", () => {
  test("escapes mrkdwn and keeps within Block Kit limits", () => {
    const blocks = headerBlocks(
      {
        title: "t".repeat(200),
        severity: "major",
        status: "open",
        summary: `<!channel> ping <@U123> & ${"&".repeat(1000)}`,
      },
      "https://app.test/incidents/1",
    );
    const header = blocks[0];
    const section = blocks[1];
    if (header.type !== "header" || section.type !== "section") {
      throw new Error("unexpected block layout");
    }
    expect(header.text.text.length).toBeLessThanOrEqual(150);
    expect(section.text.text.length).toBeLessThanOrEqual(3000);
    expect(section.text.text).not.toContain("<!channel>");
    expect(section.text.text).toContain("&lt;!channel&gt;");
    expect(section.text.text).not.toMatch(/&[a-z]*…$/);
  });
});
