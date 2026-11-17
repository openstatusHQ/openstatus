import { beforeAll, describe, expect, test } from "vitest";

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

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  userId = fixture.userId;
  userCtx = makeUserCtx(fixture.workspace, { userId });
});

describe("submitFeedback", () => {
  test("stores the row for the actor's workspace and user", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { feedback } = await submitFeedback({
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
      const { feedback } = await submitFeedback({
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
