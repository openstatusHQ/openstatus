import { integration } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { ConflictError, ForbiddenError } from "../../errors";
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

  test("a bot parent is left out but its human replies are kept", async () => {
    const client = history({
      top: [
        { ts: "100.0", text: "Incident card", bot_id: "B1", reply_count: 1 },
      ],
      threads: { "100.0": [{ ts: "100.5", text: "looking", user: "U1" }] },
    });
    const { text } = await collectChannelTranscript(client, "C1");
    expect(text).not.toContain("Incident card");
    expect(text).toContain("looking");
  });

  test("threads are paginated and count toward the cap", async () => {
    const replies = Array.from({ length: 600 }, (_, i) => ({
      ts: `100.${i + 1}`,
      text: `reply ${i}`,
      user: "U1",
    }));
    const client: SlackHistoryClient = {
      conversations: {
        history: async () => ({
          messages: [
            { ts: "100.0", text: "start", user: "U1", reply_count: 600 },
          ],
        }),
        replies: async ({ cursor }) => {
          const from = Number(cursor ?? 0);
          const page = replies.slice(from, from + 200);
          const next =
            from + 200 < replies.length ? String(from + 200) : undefined;
          return {
            messages:
              from === 0 ? [{ ts: "100.0", text: "start" }, ...page] : page,
            has_more: Boolean(next),
            response_metadata: { next_cursor: next },
          };
        },
      },
    };
    const { text, truncated } = await collectChannelTranscript(client, "C1");
    const lines = text.split("\n");
    expect(lines).toHaveLength(500);
    expect(lines[0]).toContain("start");
    expect(text).toContain("reply 498");
    expect(text).not.toContain("reply 499");
    expect(truncated).toBe(true);
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

  test("an unresolved incident is refused before the model is called", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(workspace, { userId }), db: tx };
      const row = await declareIncident({
        ctx,
        input: { title: "Still burning", severity: "minor" },
      });
      let calls = 0;
      await expect(
        generatePostmortemDraft({
          ctx,
          incidentId: row.id,
          generate: async () => {
            calls++;
            return "";
          },
        }),
      ).rejects.toThrow(ConflictError);
      expect(calls).toBe(0);
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
