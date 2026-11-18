import { db, eq } from "@openstatus/db";
import { feedback } from "@openstatus/db/src/schema";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeMcpCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { PreconditionFailedError } from "../../errors";
import { hasSubmittedFeedback, submitFeedback } from "../index.ts";

let userCtx: ServiceContext;
let userId: number;
const WEBHOOK = "https://hooks.slack.test/feedback";

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  userId = fixture.userId;
  userCtx = makeUserCtx(fixture.workspace, { userId });
});

afterAll(async () => {
  await db
    .delete(feedback)
    .where(eq(feedback.workspaceId, userCtx.workspace.id));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("submitFeedback", () => {
  test.each([
    ["rejects", () => Promise.reject(new Error("slack down"))],
    ["answers 500", () => Promise.resolve(new Response("no", { status: 500 }))],
  ])("still stores and resolves when the webhook %s", async (_, respond) => {
    const fetchMock = vi.fn(respond);
    vi.stubGlobal("fetch", fetchMock);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const stored = await submitFeedback({
      ctx: userCtx,
      input: { source: "support", message: "hello", path: "/" },
      slackWebhookUrl: WEBHOOK,
    });

    const row = await db
      .select({ id: feedback.id })
      .from(feedback)
      .where(eq(feedback.id, stored.id))
      .get();
    expect(row?.id).toBe(stored.id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalled();
  });

  test("escapes Slack mentions and bounds the webhook call", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await submitFeedback({
      ctx: userCtx,
      input: { source: "mcp", message: "<!channel> a & b", path: "<@U123>" },
      slackWebhookUrl: WEBHOOK,
    });

    const init = (
      fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    )[1];
    const { text } = JSON.parse(String(init.body)) as { text: string };
    expect(text).toContain("*Message:* &lt;!channel&gt; a &amp; b");
    expect(text).toContain("*Path:* &lt;@U123&gt;");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  test("does not post from inside a caller's transaction", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await withTestTransaction(async (tx) => {
      await submitFeedback({
        ctx: { ...userCtx, db: tx },
        input: { source: "widget", message: "hello", path: "/" },
        slackWebhookUrl: WEBHOOK,
      });
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("stores the row for the actor's workspace and user", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const feedback = await submitFeedback({
        ctx,
        input: {
          source: "widget",
          message: "  Love it  ",
          path: "/monitors",
          metadata: { isMobile: true },
        },
      });

      expect(feedback.workspaceId).toBe(ctx.workspace.id);
      expect(feedback.userId).toBe(userId);
      expect(feedback.message).toBe("Love it");
      expect(feedback.metadata).toBe(JSON.stringify({ isMobile: true }));
    });
  });

  test("accepts a read-only key linked to a user", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = {
        ...makeMcpCtx(userCtx.workspace, {
          keyId: "k",
          userId,
          scopes: ["monitors:read"],
        }),
        db: tx,
      };
      const feedback = await submitFeedback({
        ctx,
        input: { source: "mcp", message: "tool failed", path: "mcp" },
      });
      expect(feedback.source).toBe("mcp");
      expect(feedback.userId).toBe(userId);
    });
  });

  test("rejects a credential with no linked user", async () => {
    const ctx = makeApiKeyCtx(userCtx.workspace, { keyId: "k" });
    await expect(
      submitFeedback({
        ctx,
        input: { source: "mcp", message: "x", path: "mcp" },
      }),
    ).rejects.toBeInstanceOf(PreconditionFailedError);
  });
});

describe("hasSubmittedFeedback", () => {
  test("turns true per user and source", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const input = { source: "upgrade-intent" as const };
      expect(await hasSubmittedFeedback({ ctx, input })).toBe(false);

      await submitFeedback({
        ctx,
        input: { ...input, message: "A status page", path: "/settings" },
      });

      expect(await hasSubmittedFeedback({ ctx, input })).toBe(true);
      expect(
        await hasSubmittedFeedback({ ctx, input: { source: "widget" } }),
      ).toBe(false);
    });
  });
});
