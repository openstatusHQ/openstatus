import { integration } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { ForbiddenError } from "../../errors";
import { SLACK_BOT_SCOPES } from "../../integration/slack-scopes";
import type { Workspace } from "../../types";
import {
  bindIncidentSlackChannel,
  collectChannelTranscript,
  declareIncident,
  generatePostmortemDraft,
  getPostmortem,
  setIncidentStatus,
  type SlackHistoryClient,
} from "../index";

let workspace: Workspace;
let freeWorkspace: Workspace;
let userId: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  workspace = team.workspace;
  userId = team.userId;
  freeWorkspace = (await createWorkspaceFixture("free")).workspace;
});

function history(pages: {
  top: {
    ts: string;
    text: string;
    user?: string;
    bot_id?: string;
    reply_count?: number;
  }[];
  threads?: Record<string, { ts: string; text: string; user?: string }[]>;
}): SlackHistoryClient {
  return {
    conversations: {
      history: async () => ({ ok: true, messages: [...pages.top].reverse() }),
      replies: async ({ ts }) => ({
        ok: true,
        messages: [{ ts, text: "parent" }, ...(pages.threads?.[ts] ?? [])],
      }),
    },
  };
}

describe("collectChannelTranscript", () => {
  test("oldest first, bots out, threads inlined under their parent", async () => {
    const client = history({
      top: [
        { ts: "100.0", text: "API is down", user: "U1", reply_count: 1 },
        { ts: "101.0", text: "Incident card", bot_id: "B1" },
        { ts: "102.0", text: "Rolled back", user: "U2" },
      ],
      threads: { "100.0": [{ ts: "100.5", text: "on it", user: "U3" }] },
    });
    const { text, truncated } = await collectChannelTranscript(client, "C1");
    const lines = text.split("\n");
    expect(lines[0]).toContain("API is down");
    expect(lines[1]).toMatch(/^ {4}.*on it/);
    expect(lines[2]).toContain("Rolled back");
    expect(text).not.toContain("Incident card");
    expect(truncated).toBe(false);
  });
});

async function resolvedIncident(tx: DB, ctx: ServiceContext, bound: boolean) {
  const row = await declareIncident({
    ctx,
    input: { title: "Checkout down", severity: "critical" },
  });
  if (bound) {
    await tx.insert(integration).values({
      name: "slack-agent",
      workspaceId: workspace.id,
      externalId: "T_PM",
      credential: { botToken: "xoxb-test", botUserId: "UBOT" },
      data: { teamId: "T_PM", scopes: SLACK_BOT_SCOPES.join(",") },
    });
    await bindIncidentSlackChannel({
      ctx,
      input: { id: row.id, teamId: "T_PM", channelId: "C_PM" },
    });
  }
  await setIncidentStatus({ ctx, input: { id: row.id, status: "resolved" } });
  return row;
}

describe("generatePostmortemDraft", () => {
  test("builds the prompt from the incident and channel, keeps the transcript", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(workspace, { userId }), db: tx };
      const row = await resolvedIncident(tx, ctx, true);
      const prompts: string[] = [];
      const draft = await generatePostmortemDraft({
        ctx,
        incidentId: row.id,
        generate: async ({ prompt }) => {
          prompts.push(prompt);
          return "## Summary\n\nIt broke.";
        },
        slackFor: () =>
          history({ top: [{ ts: "200.0", text: "DB failover", user: "U1" }] }),
      });
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("Checkout down");
      expect(prompts[0]).toContain("DB failover");
      expect(draft.draftedBy).toBe("agent");
      expect(draft.sourceTranscript).toContain("DB failover");
      expect(draft.content).toContain("Drafted by the openstatus agent");
      expect((await getPostmortem({ ctx, input: { id: row.id } }))?.id).toBe(
        draft.id,
      );
    });
  });

  test("a long channel is summarized in windows first and says so", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(workspace, { userId }), db: tx };
      const row = await resolvedIncident(tx, ctx, true);
      const long = "x".repeat(300);
      const top = Array.from({ length: 400 }, (_, i) => ({
        ts: `${300 + i}.0`,
        text: `${long} ${i}`,
        user: "U1",
      }));
      let calls = 0;
      const draft = await generatePostmortemDraft({
        ctx,
        incidentId: row.id,
        generate: async () => {
          calls++;
          return "summary";
        },
        slackFor: () => history({ top }),
      });
      expect(calls).toBeGreaterThan(2);
      expect(draft.content).toContain("summarized in parts");
    });
  });

  test("without a channel it drafts from the timeline and says so", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(workspace, { userId }), db: tx };
      const row = await resolvedIncident(tx, ctx, false);
      const draft = await generatePostmortemDraft({
        ctx,
        incidentId: row.id,
        generate: async () => "## Summary",
      });
      expect(draft.sourceTranscript).toBeNull();
      expect(draft.content).toContain("had no Slack channel");
    });
  });

  test("a plan without the agent is refused", async () => {
    await expect(
      generatePostmortemDraft({
        ctx: makeUserCtx(freeWorkspace, { userId }),
        incidentId: 1,
        generate: async () => "",
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});
