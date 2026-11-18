import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, eq } from "@openstatus/db";
import { feedback } from "@openstatus/db/src/schema";
import type { Scope, Workspace } from "@openstatus/db/src/schema";
import type { ServiceContext } from "@openstatus/services";
import {
  createWorkspaceFixture,
  withTestTransaction,
} from "@openstatus/services/test/helpers";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import { toServiceCtx } from "../adapter";
import { registerFeedbackTools } from "./feedback";

let workspace: Workspace;
let userId: number;
let keySeq = 0;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspace = fixture.workspace;
  userId = fixture.userId;
});

afterAll(async () => {
  await db.delete(feedback).where(eq(feedback.workspaceId, workspace.id));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// A fresh key id per ctx keeps the hourly budget from leaking between tests.
function makeCtx(opts: {
  db?: ServiceContext["db"];
  createdById?: number;
  scopes?: Scope[];
}): ServiceContext {
  return {
    ...toServiceCtx({
      workspace,
      apiKey: {
        id: `feedback-test-${++keySeq}`,
        createdById: opts.createdById,
        scopes: opts.scopes ?? ["write"],
      },
    }),
    db: opts.db,
  };
}

function submitTool(ctx: ServiceContext, slackWebhookUrl?: string) {
  const server = new McpServer(
    { name: "test", version: "0.0.0" },
    { capabilities: { tools: { listChanged: false } } },
  );
  const tool = registerFeedbackTools(server, ctx, { slackWebhookUrl }).get(
    "submit_feedback",
  );
  if (!tool) throw new Error("submit_feedback not registered");
  return (args: Record<string, unknown>) =>
    // oxlint-disable-next-line typescript/no-explicit-any -- minimal `extra` for a unit test
    (tool.handler as any)(args, {}) as Promise<{
      isError?: boolean;
      structuredContent?: unknown;
      content: { text: string }[];
    }>;
}

describe("submit_feedback", () => {
  test("stores the feedback for the credential's user, read-only key included", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeCtx({
        db: tx,
        createdById: userId,
        scopes: ["monitors:read"],
      });
      const result = await submitTool(ctx)({
        message: "create_monitor rejected a valid cron",
        type: "bug",
        tool: "create_monitor",
        blocker: true,
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({ received: true });

      const rows = await tx
        .select()
        .from(feedback)
        .where(eq(feedback.workspaceId, workspace.id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId,
        source: "mcp",
        type: "bug",
        blocker: true,
        path: "create_monitor",
        message: "create_monitor rejected a valid cron",
      });
    });
  });

  test("posts to the configured Slack webhook", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await submitTool(
      makeCtx({ createdById: userId }),
      "https://hooks.slack.test/feedback",
    )({ message: "missing delete_monitor", type: "feature" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(url).toBe("https://hooks.slack.test/feedback");
    const { text } = JSON.parse(init.body) as { text: string };
    expect(text).toContain("*Source:* mcp");
    expect(text).toContain(`*Workspace:* ${workspace.slug}`);
    expect(text).toContain("*Message:* missing delete_monitor");
  });

  test("returns a recoverable error for a credential with no user", async () => {
    const result = await submitTool(makeCtx({}))({ message: "hello" });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("linked to a user");
  });

  test("caps submissions per credential per hour", async () => {
    await withTestTransaction(async (tx) => {
      const call = submitTool(makeCtx({ db: tx, createdById: userId }));
      for (let i = 0; i < 10; i++) {
        expect((await call({ message: `n${i}` })).isError).toBeFalsy();
      }
      const over = await call({ message: "one too many" });
      expect(over.isError).toBe(true);
      expect(over.content[0]?.text).toContain("Feedback budget reached");
    });
  });
});
